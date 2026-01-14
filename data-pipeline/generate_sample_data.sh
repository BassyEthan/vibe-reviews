#!/bin/bash
# Quick script to generate sample data and populate the system

echo "🔄 Generating sample data..."
cd "$(dirname "$0")"

# Set to use sample data (not Foursquare)
export USE_FOURSQUARE=false

# Generate sample data
echo "📝 Running scraper with sample data..."
python3 scraper.py

# Generate embeddings
echo "🧠 Generating embeddings..."
python3 embedder.py

# Upload to Pinecone
echo "☁️  Uploading to Pinecone..."
python3 upsert_pinecone.py

echo "✅ Done! Sample data generated and uploaded."
echo ""
echo "📊 Data Summary:"
echo "   - Restaurants: Check data/sample/restaurants.json"
echo "   - Reviews: Check data/sample/reviews.json"
echo "   - Images: Check data/sample/images.json"
echo "   - Embeddings: Check data/embeddings/"
