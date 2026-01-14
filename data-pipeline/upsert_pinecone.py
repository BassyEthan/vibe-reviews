"""
Vector DB synchronization - upserts embeddings to Pinecone Serverless index.
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
import structlog

logger = structlog.get_logger()

# Load environment variables
load_dotenv()


class PineconeUpserter:
    """Handles upserting vectors to Pinecone Serverless index."""
    
    def __init__(self):
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise ValueError("PINECONE_API_KEY not found in environment variables")
        
        self.pc = Pinecone(api_key=api_key)
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "vibe-search")
        self.index = None
        logger.info("PineconeUpserter initialized", index_name=self.index_name)
    
    def ensure_index_exists(self, dimension: int, metric: str = "cosine"):
        """Create index if it doesn't exist."""
        existing_indexes = [idx.name for idx in self.pc.list_indexes()]
        
        if self.index_name not in existing_indexes:
            logger.info("Creating Pinecone index", 
                       name=self.index_name, 
                       dimension=dimension, 
                       metric=metric)
            self.pc.create_index(
                name=self.index_name,
                dimension=dimension,
                metric=metric,
                spec=ServerlessSpec(
                    cloud="aws",
                    region=os.getenv("PINECONE_ENVIRONMENT", "us-east-1")
                )
            )
            logger.info("Index created successfully")
        else:
            logger.info("Index already exists")
        
        self.index = self.pc.Index(self.index_name)
    
    def upsert_reviews(self, review_embeddings: List[Dict[str, Any]]):
        """Upsert review embeddings to Pinecone."""
        # Ensure index exists with correct dimension (512 for text embeddings - matches CLIP)
        self.ensure_index_exists(dimension=512)
        
        vectors = []
        for item in review_embeddings:
            vector = {
                "id": f"review_{item['id']}",
                "values": item["embedding"],
                "metadata": {
                    "type": "review",
                    "restaurant_id": item["restaurant_id"],
                    "text": item["text"],
                    **item.get("metadata", {})
                }
            }
            vectors.append(vector)
        
        # Upsert in batches of 100
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            self.index.upsert(vectors=batch)
            logger.info("Upserted review batch", 
                       batch_num=i // batch_size + 1, 
                       size=len(batch))
        
        logger.info("All reviews upserted", total=len(vectors))
    
    def upsert_images(self, image_embeddings: List[Dict[str, Any]]):
        """Upsert image embeddings to Pinecone."""
        # Use the same index for both text and images (both are 512 dimensions)
        # Ensure index exists with correct dimension (512 for CLIP embeddings)
        self.ensure_index_exists(dimension=512)
        
        image_index = self.index  # Use the same index
        
        vectors = []
        for item in image_embeddings:
            vector = {
                "id": f"image_{item['id']}",
                "values": item["embedding"],
                "metadata": {
                    "type": "image",
                    "restaurant_id": item["restaurant_id"],
                    "url": item["url"],
                    **item.get("metadata", {})
                }
            }
            vectors.append(vector)
        
        # Upsert in batches of 100
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            image_index.upsert(vectors=batch)
            logger.info("Upserted image batch", 
                       batch_num=i // batch_size + 1, 
                       size=len(batch))
        
        logger.info("All images upserted", total=len(vectors))
        logger.info("Using same index for both text and images", index_name=self.index_name)
    
    def upsert_restaurants(self, restaurants_file: Path):
        """Upsert restaurant metadata (optional - for filtering)."""
        with open(restaurants_file, "r") as f:
            restaurants = json.load(f)
        
        logger.info("Restaurant metadata loaded", count=len(restaurants))
        # In production, you might want to store restaurant metadata separately
        # or include it in the review/image metadata
        return restaurants


def main():
    """Main entry point for Pinecone upsert."""
    embeddings_dir = Path(__file__).parent / "data" / "embeddings"
    
    upserter = PineconeUpserter()
    
    # Upsert reviews
    review_embeddings_file = embeddings_dir / "review_embeddings.json"
    if review_embeddings_file.exists():
        with open(review_embeddings_file, "r") as f:
            review_embeddings = json.load(f)
        upserter.upsert_reviews(review_embeddings)
    else:
        logger.warning("Review embeddings file not found", path=str(review_embeddings_file))
    
    # Upsert images (now with real CLIP embeddings from free image sources)
    image_embeddings_file = embeddings_dir / "image_embeddings.json"
    if image_embeddings_file.exists():
        with open(image_embeddings_file, "r") as f:
            image_embeddings = json.load(f)
        
        if not image_embeddings or len(image_embeddings) == 0:
            logger.warning("Image embeddings file is empty. Run scraper.py first to get data, then embedder.py to generate embeddings.")
        else:
            # Check if embeddings are all zeros (placeholders) or real embeddings
            sample_embedding = image_embeddings[0].get("embedding", [])
            if all(v == 0.0 for v in sample_embedding):
                logger.warning("Image embeddings are still placeholders (all zeros). Run embedder.py to generate real CLIP embeddings first.")
            else:
                logger.info("Upserting real image embeddings to Pinecone", count=len(image_embeddings))
                upserter.upsert_images(image_embeddings)
    else:
        logger.warning("Image embeddings file not found", path=str(image_embeddings_file))
    
    logger.info("Pinecone upsert complete")


if __name__ == "__main__":
    main()
