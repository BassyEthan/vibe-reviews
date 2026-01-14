"""
Distributed review/image scraper for Vibe Engine.
Supports both sample data generation and real API integration.
"""

import json
import os
import time
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict
import requests
import structlog

logger = structlog.get_logger()


@dataclass
class Restaurant:
    """Restaurant data model."""
    id: str
    name: str
    location: str
    cuisine_type: str
    description: str


@dataclass
class Review:
    """Review data model."""
    id: str
    restaurant_id: str
    text: str
    rating: float
    author: str
    date: str


@dataclass
class Image:
    """Image data model."""
    id: str
    restaurant_id: str
    url: str
    description: str
    local_path: Optional[str] = None


class SampleDataGenerator:
    """Generates sample restaurant data for local testing."""
    
    SAMPLE_RESTAURANTS = [
        {
            "name": "The Dark Corner",
            "location": "Berkeley, CA",
            "cuisine_type": "Bar",
            "description": "A moody, dimly lit bar with exposed brick walls and vintage decor. Perfect for intimate conversations."
        },
        {
            "name": "Sunny Bistro",
            "location": "San Francisco, CA",
            "cuisine_type": "Cafe",
            "description": "Bright and airy space with large windows, plants everywhere, and a cheerful atmosphere."
        },
        {
            "name": "Midnight Diner",
            "location": "Oakland, CA",
            "cuisine_type": "Diner",
            "description": "Retro 1950s diner with neon signs, vinyl booths, and a nostalgic vibe. Open late."
        },
        {
            "name": "Garden Terrace",
            "location": "Berkeley, CA",
            "cuisine_type": "Restaurant",
            "description": "Elegant outdoor dining with string lights, fresh flowers, and a romantic ambiance."
        },
        {
            "name": "Industrial Brew",
            "location": "San Francisco, CA",
            "cuisine_type": "Brewery",
            "description": "Modern industrial space with high ceilings, concrete floors, and craft beer focus."
        }
    ]
    
    SAMPLE_REVIEWS = [
        "Dark and moody atmosphere, perfect for a date night. The lighting is dim and romantic.",
        "Cozy vibes with great music. Feels like a hidden gem in the city.",
        "Bright and welcoming space. Great for brunch with friends on a sunny day.",
        "Industrial aesthetic with exposed pipes and brick. Very Instagram-worthy.",
        "Intimate setting with soft lighting. The ambiance is perfect for deep conversations.",
        "Retro vibes everywhere. Feels like stepping back in time to the 1950s.",
        "Elegant and sophisticated. The decor creates a luxurious dining experience.",
        "Casual and laid-back atmosphere. Great place to unwind after work.",
        "Romantic outdoor setting with beautiful lighting. Perfect for special occasions.",
        "Modern and minimalist design. Clean lines and contemporary art on the walls."
    ]
    
    def generate_sample_data(self, num_restaurants: int = 5, reviews_per_restaurant: int = 20) -> dict:
        """Generate sample restaurant, review, and image data."""
        restaurants = []
        reviews = []
        images = []
        
        for i, rest_data in enumerate(self.SAMPLE_RESTAURANTS[:num_restaurants]):
            rest_id = str(uuid.uuid4())
            restaurant = Restaurant(
                id=rest_id,
                name=rest_data["name"],
                location=rest_data["location"],
                cuisine_type=rest_data["cuisine_type"],
                description=rest_data["description"]
            )
            restaurants.append(restaurant)
            
            # Generate reviews
            for j in range(reviews_per_restaurant):
                review_id = str(uuid.uuid4())
                review_text = self.SAMPLE_REVIEWS[j % len(self.SAMPLE_REVIEWS)]
                review = Review(
                    id=review_id,
                    restaurant_id=rest_id,
                    text=review_text,
                    rating=4.0 + (j % 2) * 0.5,  # 4.0 or 4.5
                    author=f"User{j+1}",
                    date=f"2024-01-{(j % 28) + 1:02d}"
                )
                reviews.append(review)
            
            # Generate image metadata (placeholder URLs)
            for k in range(3):  # 3 images per restaurant
                image_id = str(uuid.uuid4())
                image = Image(
                    id=image_id,
                    restaurant_id=rest_id,
                    url=f"https://example.com/images/{rest_id}/{k}.jpg",
                    description=f"Interior photo of {restaurant.name} showing {self.SAMPLE_REVIEWS[k % len(self.SAMPLE_REVIEWS)].lower()}"
                )
                images.append(image)
        
        return {
            "restaurants": [asdict(r) for r in restaurants],
            "reviews": [asdict(r) for r in reviews],
            "images": [asdict(i) for i in images]
        }
    
    def save_to_json(self, data: dict, output_dir: Path):
        """Save generated data to JSON files."""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        with open(output_dir / "restaurants.json", "w") as f:
            json.dump(data["restaurants"], f, indent=2)
        
        with open(output_dir / "reviews.json", "w") as f:
            json.dump(data["reviews"], f, indent=2)
        
        with open(output_dir / "images.json", "w") as f:
            json.dump(data["images"], f, indent=2)
        
        logger.info("Sample data saved",
                   restaurants=len(data["restaurants"]),
                   reviews=len(data["reviews"]),
                   images=len(data["images"]),
                   output_dir=str(output_dir))


class FoursquareScraper:
    """Scrapes real restaurant data from Foursquare Places API."""

    def __init__(self, api_key: str):
        """Initialize Foursquare scraper with API credentials."""
        self.api_key = api_key
        self.base_url = "https://places-api.foursquare.com"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "X-Places-Api-Version": "2025-02-05",
            "Accept": "application/json"
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        logger.info("FoursquareScraper initialized with new Places API")

    def _make_request(self, url: str, params: Dict = None, retry_count: int = 3) -> Optional[Dict]:
        """Make API request with error handling and rate limit retry."""
        for attempt in range(retry_count):
            try:
                response = self.session.get(url, params=params, timeout=10)
                
                # Check rate limit headers (if available)
                rate_limit_remaining = response.headers.get('X-RateLimit-Remaining')
                rate_limit_reset = response.headers.get('X-RateLimit-Reset')
                if rate_limit_remaining:
                    logger.debug(f"Rate limit remaining: {rate_limit_remaining}", url=url)
                
                response.raise_for_status()
                return response.json()
            except requests.HTTPError as e:
                # Foursquare API returns 403 for rate limits (per docs), but may also return 429
                if e.response.status_code in [403, 429]:  # Rate limited
                    # Check rate limit headers for reset time
                    rate_limit_reset = e.response.headers.get('X-RateLimit-Reset')
                    rate_limit_remaining = e.response.headers.get('X-RateLimit-Remaining', 'unknown')
                    rate_limit_limit = e.response.headers.get('X-RateLimit-Limit', 'unknown')
                    retry_after = e.response.headers.get('Retry-After')
                    
                    # Log rate limit info
                    logger.warning(f"Rate limited ({e.response.status_code}). Limit: {rate_limit_limit}, Remaining: {rate_limit_remaining}, Reset: {rate_limit_reset or 'unknown'}")
                    
                    if retry_after:
                        wait_time = int(retry_after)
                        logger.warning(f"API says wait {wait_time}s (Retry-After header)", url=url)
                    elif rate_limit_reset:
                        # Calculate wait time until reset (X-RateLimit-Reset is a timestamp)
                        try:
                            reset_timestamp = int(rate_limit_reset)
                            current_time = int(time.time())
                            wait_time = max(reset_timestamp - current_time, 60)  # At least 60 seconds
                            logger.warning(f"Rate limit resets at {reset_timestamp}, waiting {wait_time}s", url=url)
                        except (ValueError, TypeError):
                            # If timestamp parsing fails, use exponential backoff
                            wait_time = (2 ** attempt) * 30
                            logger.warning(f"Could not parse reset time, using exponential backoff: {wait_time}s", url=url)
                    else:
                        # Fallback to exponential backoff: 30s, 60s, 120s
                        # Per Foursquare docs: limits reset hourly, so wait at least 60 seconds
                        wait_time = (2 ** attempt) * 30
                        logger.warning(f"Rate limited (no reset info), waiting {wait_time}s before retry {attempt+1}/{retry_count}", url=url)
                    
                    time.sleep(wait_time)
                    if attempt == retry_count - 1:
                        logger.error("Max retries exceeded for rate limit. Per Foursquare docs: venues/* = 5,000/hour, other endpoints = 500/hour. Wait 1 hour for reset.", url=url)
                        return None
                else:
                    logger.error("API request failed", url=url, error=str(e), status_code=e.response.status_code)
                    return None
            except requests.RequestException as e:
                logger.error("API request failed", url=url, error=str(e))
                return None
        return None

    def _format_location(self, location: Dict) -> str:
        """Format location from Foursquare data to 'City, State' format."""
        locality = location.get("locality", "")
        region = location.get("region", "")

        if locality and region:
            return f"{locality}, {region}"
        elif location.get("formatted_address"):
            return location["formatted_address"]
        elif location.get("address"):
            return location["address"]
        else:
            return "San Francisco, CA"

    def _parse_date(self, timestamp: str) -> str:
        """Parse ISO timestamp to YYYY-MM-DD format."""
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            return dt.strftime("%Y-%m-%d")
        except Exception as e:
            logger.warning("Date parsing failed", timestamp=timestamp, error=str(e))
            return datetime.now().strftime("%Y-%m-%d")

    def _generate_description(self, restaurant_data: Dict) -> str:
        """Generate description from restaurant data if not available."""
        name = restaurant_data.get("name", "Restaurant")
        categories = restaurant_data.get("categories", [])
        location = restaurant_data.get("location", {})

        cuisine = categories[0]["name"] if categories else "Restaurant"
        city = location.get("locality", "San Francisco")

        return f"{cuisine} in {city}"

    def search_restaurants(self, ll: str = "37.7749,-122.4194", radius: int = 5000, limit: int = 50) -> List[Dict]:
        """Search for restaurants using Foursquare Place Search API."""
        url = f"{self.base_url}/places/search"
        params = {
            "query": "restaurant",
            "ll": ll,
            "radius": radius,
            "limit": limit
        }

        logger.info("Searching for restaurants", ll=ll, radius=radius, limit=limit)
        data = self._make_request(url, params)

        if data and "results" in data:
            logger.info("Found restaurants", count=len(data["results"]))
            return data["results"]
        else:
            logger.error("No restaurants found in search response")
            return []

    def get_restaurant_details(self, fsq_id: str) -> Optional[Dict]:
        """Get full restaurant details using Foursquare Place Details API.

        New API returns tips and photos as fields in the details response.
        """
        url = f"{self.base_url}/places/{fsq_id}"
        params = {
            "fields": "description,tel,website,social_media,hours,hours_popular,rating,price,menu,photos,tips,tastes,attributes,name,location,categories"
        }

        data = self._make_request(url, params)

        if data:
            logger.info("Retrieved restaurant details", fsq_id=fsq_id, name=data.get("name"))
            return data
        else:
            logger.error("Failed to retrieve restaurant details", fsq_id=fsq_id)
            return None

    def scrape_restaurants(self, num_restaurants: int = 100) -> dict:
        """Main method: Scrape restaurants and return data in our schema format."""
        restaurants = []
        reviews = []
        images = []

        # Step 1: Search for restaurants
        search_results = self.search_restaurants(limit=min(num_restaurants, 50))

        if not search_results:
            logger.error("No restaurants found in search")
            return {"restaurants": [], "reviews": [], "images": []}

        # Limit to requested number
        search_results = search_results[:num_restaurants]

        # Step 2: Process each restaurant
        for i, result in enumerate(search_results):
            # New API uses fsq_place_id instead of fsq_id
            fsq_id = result.get("fsq_place_id") or result.get("fsq_id")
            if not fsq_id:
                logger.warning("Skipping restaurant without fsq_place_id", result=result)
                continue

            logger.info(f"Processing restaurant {i+1}/{len(search_results)}", fsq_id=fsq_id)

            # Use data from search results (already has most fields)
            restaurant_uuid = str(uuid.uuid4())
            restaurant = Restaurant(
                id=restaurant_uuid,
                name=result.get("name", "Unknown Restaurant"),
                location=self._format_location(result.get("location", {})),
                cuisine_type=result.get("categories", [{}])[0].get("name", "Restaurant") if result.get("categories") else "Restaurant",
                description=self._generate_description(result)
            )
            restaurants.append(restaurant)

            # CRITICAL: Details endpoint has stricter rate limits per Foursquare docs
            # Per official docs: "other endpoints" = 500 requests/hour
            # 500/hour = 1 request per 7.2 seconds minimum
            # Use 15 seconds to be safe and avoid hitting limits
            delay_seconds = 15
            logger.info(f"Waiting {delay_seconds}s before fetching details (500/hour limit = ~7.2s/request minimum)", restaurant=restaurant.name)
            time.sleep(delay_seconds)

            # Get detailed information for photos and tips only
            details = self.get_restaurant_details(fsq_id)
            if not details:
                logger.warning("Could not get details (photos/tips), using search data only", fsq_id=fsq_id, name=restaurant.name)
                # If rate limited, wait longer before next restaurant
                # Wait 30 seconds to let rate limit window reset
                time.sleep(30)
                continue

            # Extract tips (reviews) from details response
            tips = details.get("tips", [])
            restaurant_rating = details.get("rating", 4.0)

            # Rating in new API is out of 10, convert to 5.0 scale
            if restaurant_rating > 5:
                restaurant_rating = restaurant_rating / 2

            for tip in tips:
                review_id = str(uuid.uuid4())
                review = Review(
                    id=review_id,
                    restaurant_id=restaurant_uuid,
                    text=tip.get("text", ""),
                    rating=restaurant_rating,
                    author=tip.get("user", {}).get("firstName", tip.get("user", {}).get("first_name", "Anonymous")),
                    date=self._parse_date(tip.get("created_at", datetime.now().isoformat()))
                )
                reviews.append(review)

            # Extract photos from details response
            photos = details.get("photos", [])

            for photo in photos:
                image_id = str(uuid.uuid4())
                prefix = photo.get("prefix", "")
                suffix = photo.get("suffix", "")

                if prefix and suffix:
                    url = f"{prefix}800x800{suffix}"
                else:
                    logger.warning("Photo missing prefix/suffix", fsq_id=fsq_id)
                    continue

                image = Image(
                    id=image_id,
                    restaurant_id=restaurant_uuid,
                    url=url,
                    description=f"Photo of {restaurant.name}"
                )
                images.append(image)

            # Rate limiting between restaurants
            # Already have 5s delay before details, so minimal delay here
            time.sleep(1)

            logger.info("Processed restaurant",
                       name=restaurant.name,
                       tips_count=len([r for r in reviews if r.restaurant_id == restaurant_uuid]),
                       photos_count=len([img for img in images if img.restaurant_id == restaurant_uuid]))

        return {
            "restaurants": [asdict(r) for r in restaurants],
            "reviews": [asdict(r) for r in reviews],
            "images": [asdict(i) for i in images]
        }

    def save_to_json(self, data: dict, output_dir: Path):
        """Save scraped data to JSON files."""
        output_dir.mkdir(parents=True, exist_ok=True)

        with open(output_dir / "restaurants.json", "w") as f:
            json.dump(data["restaurants"], f, indent=2)

        with open(output_dir / "reviews.json", "w") as f:
            json.dump(data["reviews"], f, indent=2)

        with open(output_dir / "images.json", "w") as f:
            json.dump(data["images"], f, indent=2)

        logger.info("Foursquare data saved",
                   restaurants=len(data["restaurants"]),
                   reviews=len(data["reviews"]),
                   images=len(data["images"]),
                   output_dir=str(output_dir))


def main():
    """Main entry point for scraper."""
    from dotenv import load_dotenv
    load_dotenv()

    output_dir = Path(__file__).parent / "data" / "sample"
    use_foursquare = os.getenv("USE_FOURSQUARE", "false").lower() == "true"

    if use_foursquare:
        logger.info("Using Foursquare API for real data")
        api_key = os.getenv("FOURSQUARE_API_KEY")
        if not api_key:
            raise ValueError("FOURSQUARE_API_KEY not found in .env file")

        scraper = FoursquareScraper(api_key)
        # Start with 5 restaurants for testing, can be changed to 100 later
        num_restaurants = int(os.getenv("NUM_RESTAURANTS", "5"))
        data = scraper.scrape_restaurants(num_restaurants=num_restaurants)
        scraper.save_to_json(data, output_dir)
    else:
        logger.info("Using sample data generator")
        generator = SampleDataGenerator()
        data = generator.generate_sample_data(num_restaurants=5, reviews_per_restaurant=20)
        generator.save_to_json(data, output_dir)

    logger.info("Scraping complete",
                total_restaurants=len(data["restaurants"]),
                total_reviews=len(data["reviews"]),
                total_images=len(data["images"]))


if __name__ == "__main__":
    main()
