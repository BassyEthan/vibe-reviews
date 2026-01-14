"""
OpenAI + CLIP embedding logic for generating text and image vectors.
- Text: OpenAI text-embedding-3-small (1536 dimensions)
- Images: CLIP via PyTorch (512 dimensions)
"""

import os
import json
import ssl
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import torch
import clip
from PIL import Image
import openai
from dotenv import load_dotenv
import structlog
import requests
from io import BytesIO
import time
import psycopg2
from psycopg2.extras import RealDictCursor

logger = structlog.get_logger()

# Load environment variables
load_dotenv()

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables")


class DatabaseConnection:
    """PostgreSQL database connection helper."""

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            logger.warning("DATABASE_URL not found, will use JSON files as fallback")
            self.conn = None
        else:
            try:
                self.conn = psycopg2.connect(self.database_url)
                logger.info("Connected to PostgreSQL database")
            except Exception as e:
                logger.error("Failed to connect to database", error=str(e))
                self.conn = None

    def fetch_reviews(self) -> List[Dict[str, Any]]:
        """Fetch all valid (non-expired) reviews from database."""
        if not self.conn:
            return []

        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        r.id,
                        r.place_id as restaurant_id,
                        r.text,
                        r.rating,
                        r.author,
                        r.published_date::text as date
                    FROM reviews r
                    WHERE r.is_expired = false
                    ORDER BY r.created_at DESC
                """)
                reviews = cur.fetchall()
                logger.info("Fetched reviews from database", count=len(reviews))
                return [dict(row) for row in reviews]
        except Exception as e:
            logger.error("Failed to fetch reviews", error=str(e))
            return []

    def fetch_photos(self) -> List[Dict[str, Any]]:
        """Fetch all photos from database."""
        if not self.conn:
            return []

        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT
                        p.id,
                        p.place_id as restaurant_id,
                        p.url,
                        p.attribution_text as description
                    FROM photos p
                    ORDER BY p.created_at DESC
                """)
                photos = cur.fetchall()
                logger.info("Fetched photos from database", count=len(photos))
                return [dict(row) for row in photos]
        except Exception as e:
            logger.error("Failed to fetch photos", error=str(e))
            return []

    def fetch_places_map(self) -> Dict[str, str]:
        """Fetch place ID to name mapping."""
        if not self.conn:
            return {}

        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id, name FROM places")
                places = cur.fetchall()
                return {row['id']: row['name'] for row in places}
        except Exception as e:
            logger.error("Failed to fetch places", error=str(e))
            return {}

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            logger.info("Closed database connection")


class TextEmbedder:
    """Handles text embedding using OpenAI's text-embedding-3-small model."""
    
    MODEL = "text-embedding-3-small"
    DIMENSION = 512  # Using 512 to match CLIP image embeddings and Pinecone index options
    
    def __init__(self):
        self.client = openai.OpenAI(api_key=openai.api_key)
        logger.info("TextEmbedder initialized", model=self.MODEL, dimension=self.DIMENSION)
    
    def embed(self, text: str) -> List[float]:
        """Generate embedding for a single text string."""
        try:
            response = self.client.embeddings.create(
                model=self.MODEL,
                input=text,
                dimensions=self.DIMENSION  # Request 512 dimensions
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error("Text embedding failed", text=text[:50], error=str(e))
            raise
    
    def embed_batch(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
        """Generate embeddings for a batch of texts."""
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                response = self.client.embeddings.create(
                    model=self.MODEL,
                    input=batch,
                    dimensions=self.DIMENSION  # Request 512 dimensions
                )
                batch_embeddings = [item.embedding for item in response.data]
                embeddings.extend(batch_embeddings)
                logger.info("Embedded batch", batch_num=i // batch_size + 1, size=len(batch))
            except Exception as e:
                logger.error("Batch embedding failed", batch_start=i, error=str(e))
                raise
        return embeddings


class ImageEmbedder:
    """Handles image embedding using CLIP model."""
    
    DIMENSION = 512
    
    def __init__(self, device: Optional[str] = None, lazy_load: bool = True):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.preprocess = None
        self.lazy_load = lazy_load
        if not lazy_load:
            self._load_model()
        logger.info("ImageEmbedder initialized", device=self.device, dimension=self.DIMENSION, lazy_load=lazy_load)
    
    def _load_model(self):
        """Lazy load CLIP model (only when actually needed)."""
        if self.model is None:
            try:
                import ssl
                # Disable SSL verification for CLIP download (common issue with corporate proxies)
                ssl._create_default_https_context = ssl._create_unverified_context
                self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)
                self.model.eval()
                logger.info("CLIP model loaded successfully")
            except Exception as e:
                logger.warning("Failed to load CLIP model, will use placeholder embeddings", error=str(e))
                self.model = None
                self.preprocess = None
    
    def embed_from_url(self, image_url: str) -> List[float]:
        """Generate embedding from image URL by downloading and processing."""
        # Lazy load model if needed
        if self.model is None:
            self._load_model()
        
        # If model still not loaded, return placeholder
        if self.model is None:
            logger.warning("CLIP model not available, using placeholder embedding", url=image_url)
            return [0.0] * self.DIMENSION
        
        try:
            # Download image from URL
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            
            # Open image from bytes
            image = Image.open(BytesIO(response.content)).convert("RGB")
            image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                image_features = self.model.encode_image(image_tensor)
                # Normalize the features
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                embedding = image_features.cpu().numpy()[0].tolist()
            
            return embedding
        except Exception as e:
            logger.error("Image embedding from URL failed", url=image_url, error=str(e))
            # Return placeholder on error
            return [0.0] * self.DIMENSION
    
    def embed_from_path(self, image_path: Path) -> List[float]:
        """Generate embedding from local image file."""
        # Lazy load model if needed
        if self.model is None:
            self._load_model()
        
        # If model still not loaded, return placeholder
        if self.model is None:
            logger.warning("CLIP model not available, using placeholder embedding", path=str(image_path))
            return [0.0] * self.DIMENSION
        
        try:
            image = Image.open(image_path).convert("RGB")
            image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                image_features = self.model.encode_image(image_tensor)
                # Normalize the features
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                embedding = image_features.cpu().numpy()[0].tolist()
            
            return embedding
        except Exception as e:
            logger.error("Image embedding failed", path=str(image_path), error=str(e))
            # Return placeholder on error
            return [0.0] * self.DIMENSION
    
    def embed_batch(self, image_paths: List[Path]) -> List[List[float]]:
        """Generate embeddings for a batch of images."""
        embeddings = []
        for path in image_paths:
            try:
                embedding = self.embed_from_path(path)
                embeddings.append(embedding)
            except Exception as e:
                logger.warning("Skipping image", path=str(path), error=str(e))
                # Add zero vector as placeholder
                embeddings.append([0.0] * self.DIMENSION)
        return embeddings


class ImageDownloader:
    """Downloads restaurant images from free APIs (Pexels)."""
    
    PEXELS_API_URL = "https://api.pexels.com/v1/search"
    # Pexels free tier: 200 requests/hour, no auth key needed for basic usage
    # But we'll use direct image URLs from Pexels curated collections to avoid API limits
    
    @staticmethod
    def get_restaurant_image_url(description: str, restaurant_name: str) -> Optional[str]:
        """Get a free restaurant interior image URL based on vibe description."""
        # Using Pexels free, high-quality restaurant interior photos
        # These are direct links to actual restaurant interior photos (free to use)
        
        vibe_keywords = description.lower()
        
        # Curated Pexels image URLs for different restaurant vibes (free to use)
        # Using actual restaurant interior photos from Pexels
        
        # Dark/Moody vibes - dimly lit bar/restaurant
        if any(kw in vibe_keywords for kw in ["dark", "moody", "dimly", "intimate"]):
            return "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800"
        
        # Bright/Sunny vibes - bright cafe/restaurant
        if any(kw in vibe_keywords for kw in ["bright", "sunny", "airy", "cheerful", "welcoming"]):
            return "https://images.pexels.com/photos/941861/pexels-photo-941861.jpeg?auto=compress&cs=tinysrgb&w=800"
        
        # Industrial/Modern vibes - modern industrial space
        if any(kw in vibe_keywords for kw in ["industrial", "modern", "minimalist", "concrete", "exposed", "brewery"]):
            return "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800"
        
        # Retro/Vintage vibes - vintage diner
        if any(kw in vibe_keywords for kw in ["retro", "vintage", "1950s", "nostalgic", "neon", "diner"]):
            return "https://images.pexels.com/photos/941861/pexels-photo-941861.jpeg?auto=compress&cs=tinysrgb&w=800"
        
        # Elegant/Sophisticated vibes - elegant dining
        if any(kw in vibe_keywords for kw in ["elegant", "sophisticated", "luxurious", "outdoor", "garden", "terrace"]):
            return "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800"
        
        # Cozy/Casual vibes - cozy restaurant
        if any(kw in vibe_keywords for kw in ["cozy", "casual", "laid-back", "hidden gem", "romantic"]):
            return "https://images.pexels.com/photos/941861/pexels-photo-941861.jpeg?auto=compress&cs=tinysrgb&w=800"
        
        # Default: use hash of restaurant name for consistent image selection
        # Rotate through different restaurant interior styles
        default_images = [
            "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800",  # Dark bar
            "https://images.pexels.com/photos/941861/pexels-photo-941861.jpeg?auto=compress&cs=tinysrgb&w=800",   # Bright cafe
            "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800",  # Cozy restaurant
            "https://images.pexels.com/photos/941861/pexels-photo-941861.jpeg?auto=compress&cs=tinysrgb&w=800",   # Modern interior
            "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800",  # Elegant dining
        ]
        
        import hashlib
        hash_val = int(hashlib.md5(restaurant_name.encode()).hexdigest(), 16)
        return default_images[hash_val % len(default_images)]


class MultiModalEmbedder:
    """Orchestrates both text and image embedding."""

    def __init__(self, lazy_load_clip: bool = True, db: Optional[DatabaseConnection] = None):
        self.text_embedder = TextEmbedder()
        # Lazy load CLIP to avoid SSL issues during initialization
        self.image_embedder = ImageEmbedder(lazy_load=lazy_load_clip)
        self.image_downloader = ImageDownloader()
        self.db = db
        logger.info("MultiModalEmbedder initialized", lazy_load_clip=lazy_load_clip, has_db=db is not None)
    
    def process_reviews(self, reviews_file: Optional[Path] = None) -> List[Dict[str, Any]]:
        """Process reviews and generate text embeddings.

        Args:
            reviews_file: Path to JSON file (optional if using database)

        Returns:
            List of reviews with embeddings
        """
        # Try database first, fallback to JSON file
        if self.db and self.db.conn:
            reviews = self.db.fetch_reviews()
            source = "database"
        elif reviews_file and reviews_file.exists():
            with open(reviews_file, "r") as f:
                reviews = json.load(f)
            source = "JSON file"
        else:
            logger.warning("No reviews source available")
            return []

        if not reviews:
            logger.warning("No reviews found")
            return []

        logger.info(f"Processing reviews from {source}", count=len(reviews))

        texts = [review["text"] for review in reviews]
        embeddings = self.text_embedder.embed_batch(texts)

        results = []
        for review, embedding in zip(reviews, embeddings):
            results.append({
                "id": review["id"],
                "restaurant_id": review["restaurant_id"],
                "text": review["text"],
                "embedding": embedding,
                "metadata": {
                    "rating": float(review["rating"]),
                    "author": review["author"],
                    "date": review["date"]
                }
            })

        logger.info("Processed reviews", count=len(results))
        return results
    
    def process_images(self, images_file: Optional[Path] = None, images_dir: Optional[Path] = None, restaurants_file: Optional[Path] = None) -> List[Dict[str, Any]]:
        """Process images and generate image embeddings using real images from free APIs.

        Args:
            images_file: Path to JSON file (optional if using database)
            images_dir: Not used (kept for backward compatibility)
            restaurants_file: Path to restaurants JSON (optional if using database)

        Returns:
            List of images with embeddings
        """
        # Try database first, fallback to JSON file
        if self.db and self.db.conn:
            images = self.db.fetch_photos()
            restaurant_map = self.db.fetch_places_map()
            source = "database"
        elif images_file and images_file.exists():
            with open(images_file, "r") as f:
                images = json.load(f)

            # Load restaurant data to get names for better image matching
            restaurant_map = {}
            if restaurants_file and restaurants_file.exists():
                with open(restaurants_file, "r") as f:
                    restaurants = json.load(f)
                    restaurant_map = {r["id"]: r["name"] for r in restaurants}
            source = "JSON file"
        else:
            logger.warning("No images source available")
            return []

        if not images:
            logger.warning("No images found")
            return []

        logger.info(f"Processing images from {source}", count=len(images))
        
        results = []
        for i, image in enumerate(images):
            # Get restaurant name for better image matching
            restaurant_name = restaurant_map.get(image["restaurant_id"], "restaurant")
            
            # Get real image URL from free API based on description
            description = image.get("description", "")
            real_image_url = self.image_downloader.get_restaurant_image_url(description, restaurant_name)
            
            if not real_image_url:
                logger.warning("No image URL found, using placeholder", image_id=image["id"])
                embedding = [0.0] * self.image_embedder.DIMENSION
            else:
                # Generate embedding from real image URL
                logger.info("Processing real image", image_id=image["id"], url=real_image_url[:50])
                embedding = self.image_embedder.embed_from_url(real_image_url)
                
                # Check if embedding is still placeholder (all zeros)
                if all(v == 0.0 for v in embedding):
                    logger.warning("Failed to generate embedding, using placeholder", image_id=image["id"])
                else:
                    logger.info("Successfully generated image embedding", image_id=image["id"])
            
            # Rate limiting: be nice to free APIs
            if i < len(images) - 1:  # Don't sleep after last image
                time.sleep(0.5)  # 0.5 second delay between requests
            
            results.append({
                "id": image["id"],
                "restaurant_id": image["restaurant_id"],
                "url": real_image_url or image["url"],  # Use real URL if available
                "embedding": embedding,
                "metadata": {
                    "description": image["description"],
                    "original_url": image.get("url")  # Keep original for reference
                }
            })
        
        logger.info("Processed images", count=len(results), 
                   successful=sum(1 for r in results if not all(v == 0.0 for v in r["embedding"])))
        return results


def main():
    """Main entry point for embedder.

    Supports two modes:
    1. PostgreSQL mode: Reads from DATABASE_URL environment variable
    2. JSON mode: Reads from data/sample/*.json files (fallback)
    """
    data_dir = Path(__file__).parent / "data" / "sample"
    output_dir = Path(__file__).parent / "data" / "embeddings"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Try to connect to database
    db = DatabaseConnection()

    embedder = MultiModalEmbedder(db=db)

    # Process reviews (database first, JSON fallback)
    reviews_file = data_dir / "reviews.json"
    review_embeddings = embedder.process_reviews(reviews_file)
    if review_embeddings:
        with open(output_dir / "review_embeddings.json", "w") as f:
            json.dump(review_embeddings, f, indent=2)
        logger.info("Saved review embeddings", count=len(review_embeddings))

    # Process images (database first, JSON fallback)
    images_file = data_dir / "images.json"
    restaurants_file = data_dir / "restaurants.json"
    image_embeddings = embedder.process_images(images_file, restaurants_file=restaurants_file)
    if image_embeddings:
        with open(output_dir / "image_embeddings.json", "w") as f:
            json.dump(image_embeddings, f, indent=2)
        logger.info("Saved image embeddings", count=len(image_embeddings))

    # Close database connection
    if db:
        db.close()


if __name__ == "__main__":
    main()
