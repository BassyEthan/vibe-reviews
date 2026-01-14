# Foursquare Scraper Implementation Instructions

## Overview
Implement a Foursquare Places API scraper to replace the sample data generator with real San Francisco restaurant data, reviews (tips), and photos.

## Context
- Current scraper (`scraper.py`) generates fake/sample data
- We need real data from Foursquare Places API
- Must maintain the same data schema and JSON format
- Target: 50-100 SF restaurants initially
- Free tier: 100,000 requests/month

## Requirements

### 1. Data Schema (MUST MATCH EXISTING)
Keep the existing data models exactly as they are:

```python
@dataclass
class Restaurant:
    id: str
    name: str
    location: str
    cuisine_type: str
    description: str

@dataclass
class Review:
    id: str
    restaurant_id: str
    text: str
    rating: float
    author: str
    date: str

@dataclass
class Image:
    id: str
    restaurant_id: str
    url: str
    description: str
    local_path: Optional[str] = None
```

### 2. Foursquare API Integration

#### API Endpoints to Use:
1. **Place Search**: `GET /v3/places/search`
   - Search restaurants in San Francisco
   - Parameters: `query=restaurant`, `ll=37.7749,-122.4194` (SF coordinates), `radius=5000` (5km)
   - Get up to 50 results per request

2. **Place Details**: `GET /v3/places/{fsq_id}`
   - Get full restaurant details
   - Returns: name, location, categories, description, rating, etc.

3. **Place Tips**: `GET /v3/places/{fsq_id}/tips`
   - Get user tips (these act as reviews)
   - Parameters: `limit=10` (get up to 10 tips per restaurant)
   - Returns: tip text, author, created_at

4. **Place Photos**: `GET /v3/places/{fsq_id}/photos`
   - Get restaurant photos
   - Parameters: `limit=5` (get up to 5 photos per restaurant)
   - Returns: photo URLs (prefix + suffix format)

#### API Authentication:
- Header: `Authorization: YOUR_API_KEY`
- Get API key from Foursquare Developer Portal
- Store in `.env` as `FOURSQUARE_API_KEY`

### 3. Implementation Structure

Create a new class `FoursquareScraper` in `scraper.py`:

```python
class FoursquareScraper:
    """Scrapes real restaurant data from Foursquare Places API."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.foursquare.com/v3/places"
        self.headers = {
            "Authorization": api_key,
            "Accept": "application/json"
        }
    
    def search_restaurants(self, location: str, radius: int = 5000, limit: int = 50) -> List[Dict]:
        """Search for restaurants in SF using Place Search endpoint."""
        # TODO: Implement
        
    def get_restaurant_details(self, fsq_id: str) -> Dict:
        """Get full restaurant details using Place Details endpoint."""
        # TODO: Implement
        
    def get_restaurant_tips(self, fsq_id: str, limit: int = 10) -> List[Dict]:
        """Get user tips (reviews) using Place Tips endpoint."""
        # TODO: Implement
        
    def get_restaurant_photos(self, fsq_id: str, limit: int = 5) -> List[Dict]:
        """Get restaurant photos using Place Photos endpoint."""
        # TODO: Implement
        
    def scrape_restaurants(self, num_restaurants: int = 100) -> dict:
        """Main method: Scrape restaurants and return data in our schema format."""
        # TODO: Implement
        # Returns: {"restaurants": [...], "reviews": [...], "images": [...]}
```

### 4. Data Mapping

#### Restaurant Mapping (Foursquare → Our Schema):
- `id`: Generate UUID (don't use Foursquare's fsq_id directly, but store it)
- `name`: `foursquare_response.name`
- `location`: Format from `foursquare_response.location` (e.g., "San Francisco, CA")
- `cuisine_type`: First category from `foursquare_response.categories` (e.g., "Restaurant", "Bar", "Cafe")
- `description`: Use `foursquare_response.description` or combine categories

#### Review Mapping (Tips → Our Schema):
- `id`: Generate UUID
- `restaurant_id`: Use our restaurant UUID (not Foursquare ID)
- `text`: `tip.text`
- `rating`: Use restaurant's overall rating (from details) or generate from tip sentiment
- `author`: `tip.user.firstName` or "Anonymous"
- `date`: Parse `tip.created_at` to YYYY-MM-DD format

#### Image Mapping (Photos → Our Schema):
- `id`: Generate UUID
- `restaurant_id`: Use our restaurant UUID
- `url`: Construct from `photo.prefix + "800x800" + photo.suffix` (or original size)
- `description`: Use `photo.caption` or generate from restaurant name + "interior photo"

### 5. Rate Limiting

**Important**: Respect API rate limits!
- Free tier: ~1,200 requests/hour
- Add delays: `time.sleep(0.1)` between requests
- Batch operations where possible
- Handle rate limit errors gracefully (429 status)

### 6. Error Handling

- Handle missing data gracefully (some restaurants may not have photos/tips)
- Log errors but continue processing
- Skip restaurants with insufficient data
- Use try-catch blocks for API calls

### 7. Output Format

Must save to the same JSON files as current scraper:
- `data/sample/restaurants.json`
- `data/sample/reviews.json`
- `data/sample/images.json`

### 8. Update main() Function

Modify `main()` to allow choosing between sample data and Foursquare data:

```python
def main():
    """Main entry point for scraper."""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    output_dir = Path(__file__).parent / "data" / "sample"
    
    # Choose data source
    use_foursquare = os.getenv("USE_FOURSQUARE", "false").lower() == "true"
    
    if use_foursquare:
        api_key = os.getenv("FOURSQUARE_API_KEY")
        if not api_key:
            raise ValueError("FOURSQUARE_API_KEY not found in .env")
        
        scraper = FoursquareScraper(api_key)
        data = scraper.scrape_restaurants(num_restaurants=100)
        scraper.save_to_json(data, output_dir)  # Use same save method
    else:
        generator = SampleDataGenerator()
        data = generator.generate_sample_data(num_restaurants=5, reviews_per_restaurant=20)
        generator.save_to_json(data, output_dir)
    
    logger.info("Scraping complete", total_restaurants=len(data["restaurants"]))
```

### 9. Dependencies

Add to `requirements.txt` if needed:
```
requests>=2.31.0  # Already there
python-dotenv>=1.0.0  # Already there
```

### 10. Environment Variables

Add to `.env`:
```
FOURSQUARE_API_KEY=your_foursquare_api_key_here
USE_FOURSQUARE=false  # Set to "true" to use Foursquare instead of sample data
```

## Implementation Checklist

- [ ] Create `FoursquareScraper` class
- [ ] Implement `search_restaurants()` method
- [ ] Implement `get_restaurant_details()` method
- [ ] Implement `get_restaurant_tips()` method
- [ ] Implement `get_restaurant_photos()` method
- [ ] Implement `scrape_restaurants()` main method
- [ ] Map Foursquare data to our schema
- [ ] Add rate limiting (delays between requests)
- [ ] Add error handling
- [ ] Update `main()` to support both data sources
- [ ] Test with small number (5-10 restaurants first)
- [ ] Verify JSON output matches existing format
- [ ] Ensure it works with existing embedder pipeline

## Testing Steps

1. Set `USE_FOURSQUARE=true` in `.env`
2. Add `FOURSQUARE_API_KEY` to `.env`
3. Run: `python scraper.py`
4. Verify JSON files are created correctly
5. Check that data format matches existing schema
6. Run embedder to ensure compatibility: `python embedder.py`
7. Verify no errors in pipeline

## Notes

- **Foursquare IDs**: Store Foursquare's `fsq_id` somewhere (maybe in restaurant metadata) for future reference, but use UUIDs for our internal IDs
- **Missing Data**: Some restaurants may not have tips or photos - handle gracefully
- **Photo URLs**: Foursquare uses prefix/suffix format - construct full URLs correctly
- **Date Format**: Convert Foursquare timestamps to YYYY-MM-DD format for reviews
- **San Francisco Coordinates**: Use `37.7749,-122.4194` for SF center
- **Radius**: 5km (5000m) should cover most of SF

## References

- Foursquare Places API Docs: https://docs.foursquare.com/developer/reference/places-api-overview
- Place Search: https://docs.foursquare.com/developer/reference/places-search
- Place Details: https://docs.foursquare.com/developer/reference/places-details
- Place Tips: https://docs.foursquare.com/developer/reference/places-tips
- Place Photos: https://docs.foursquare.com/developer/reference/places-photos
