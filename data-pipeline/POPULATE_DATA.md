# How to Populate Data in Your System

## Current Problem
- ✅ Database tables exist (Place, Photo, Review, etc.)
- ❌ No data in tables (all showing 0)
- ❌ Reviews.json is empty `[]`
- ❌ Images.json is empty `[]`
- ✅ Only 5 restaurants exist (but no reviews/images)

## Solution: Generate Sample Data

Since Foursquare API is rate-limited, use sample data to populate the system:

### Step 1: Generate Sample Data

```bash
cd data-pipeline

# Make sure USE_FOURSQUARE is false (or not set)
# The scraper defaults to sample data if USE_FOURSQUARE is not "true"

# Generate sample data
python3 scraper.py
```

This will create:
- `data/sample/restaurants.json` - 5 restaurants
- `data/sample/reviews.json` - 100 reviews (20 per restaurant)
- `data/sample/images.json` - 15 images (3 per restaurant)

### Step 2: Generate Embeddings

```bash
python3 embedder.py
```

This will create:
- `data/embeddings/review_embeddings.json` - Text embeddings for reviews
- `data/embeddings/image_embeddings.json` - CLIP embeddings for images

### Step 3: Upload to Pinecone

```bash
python3 upsert_pinecone.py
```

This uploads embeddings to Pinecone for semantic search.

### Step 4: (Optional) Populate Database

If you want to store data in PostgreSQL:

```bash
# The embedder.py will read from JSON and can write to database
# Make sure DATABASE_URL is set in .env
python3 embedder.py
```

## Quick Script

I've created a script to do all of this:

```bash
cd data-pipeline
./generate_sample_data.sh
```

Or manually:

```bash
cd data-pipeline
USE_FOURSQUARE=false python3 scraper.py
python3 embedder.py
python3 upsert_pinecone.py
```

## Expected Results

After running the pipeline:

- **Restaurants**: 5 restaurants
- **Reviews**: 100 reviews (20 per restaurant)
- **Images**: 15 images (3 per restaurant)
- **Embeddings**: 100 review embeddings + 15 image embeddings
- **Pinecone**: All embeddings uploaded and searchable

## Verify Data

Check the JSON files:
```bash
# Count reviews
cat data/sample/reviews.json | jq '. | length'

# Count images  
cat data/sample/images.json | jq '. | length'

# View a sample review
cat data/sample/reviews.json | jq '.[0]'
```

## Next Steps

Once you have sample data:
1. ✅ Test the MCP server with `search_by_vibe`
2. ✅ Test embeddings and Pinecone search
3. ✅ Verify the dashboard shows data
4. ✅ Test the full pipeline end-to-end

Later, when Foursquare API limits reset:
- Set `USE_FOURSQUARE=true` in `.env`
- Run scraper again to get real data
- The same pipeline will work with real data
