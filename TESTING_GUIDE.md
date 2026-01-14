# Testing Guide - Step by Step

## Overview
This guide walks you through testing the entire Vibe-Reviews system end-to-end.

---

## Prerequisites Check

### 1. Verify Environment Variables

```bash
cd data-pipeline
cat .env | grep -E "OPENAI_API_KEY|PINECONE_API_KEY|FOURSQUARE_API_KEY"
```

**Required:**
- ✅ `OPENAI_API_KEY` - For embeddings
- ✅ `PINECONE_API_KEY` - For vector search
- ⚠️ `FOURSQUARE_API_KEY` - Optional (we'll use sample data)

### 2. Verify Database Connection (Optional)

```bash
cd mcp-server
npx prisma studio
# Should open browser at http://localhost:5555
# Close it when done checking
```

---

## Step 1: Generate Sample Data

### 1.1 Set Up for Sample Data

```bash
cd data-pipeline

# Make sure USE_FOURSQUARE is false or not set
# Check current setting:
cat .env | grep USE_FOURSQUARE || echo "USE_FOURSQUARE not set (will default to sample data)"
```

### 1.2 Run Scraper

```bash
python3 scraper.py
```

**Expected Output:**
```
[info] Using sample data generator
[info] Sample data saved restaurants=5 reviews=100 images=15
[info] Scraping complete total_restaurants=5 total_reviews=100 total_images=15
```

**Verify Files Created:**
```bash
# Check data was created
ls -lh data/sample/
cat data/sample/reviews.json | jq '. | length'  # Should show 100
cat data/sample/images.json | jq '. | length'   # Should show 15
```

---

## Step 2: Generate Embeddings

### 2.1 Run Embedder

```bash
python3 embedder.py
```

**Expected Output:**
```
[info] TextEmbedder initialized dimension=512 model=text-embedding-3-small
[info] ImageEmbedder initialized device=cpu dimension=512
[info] Processing reviews from JSON file count=100
[info] Embedded batch batch_num=1 size=100
[info] Processed reviews count=100
[info] Processing images from JSON file count=15
[info] Successfully generated image embedding image_id=...
[info] Processed images count=15 successful=15
[info] Saved review embeddings count=100
[info] Saved image embeddings count=15
```

**Verify Embeddings Created:**
```bash
ls -lh data/embeddings/
cat data/embeddings/review_embeddings.json | jq '. | length'  # Should show 100
cat data/embeddings/image_embeddings.json | jq '. | length'  # Should show 15
```

---

## Step 3: Upload to Pinecone

### 3.1 Run Upserter

```bash
python3 upsert_pinecone.py
```

**Expected Output:**
```
[info] PineconeUpserter initialized index_name=vibe-search
[info] Index already exists
[info] Upserted review batch batch_num=1 size=100
[info] All reviews upserted total=100
[info] Upserting real image embeddings to Pinecone count=15
[info] Upserted image batch batch_num=1 size=15
[info] All images upserted total=15
[info] Pinecone upsert complete
```

**Verify in Pinecone:**
- Go to https://app.pinecone.io
- Check your index `vibe-search`
- Should show ~115 vectors (100 reviews + 15 images)

---

## Step 4: Test MCP Server

### 4.1 Build MCP Server

```bash
cd ../mcp-server
npm run build
```

**Expected Output:**
```
> vibe-search-server@1.0.0 build
> tsc
```

### 4.2 Test MCP Server Tools

```bash
npm run test
```

**Expected Output:**
```
Testing search_by_vibe...
Query: "dark moody bar"
Results: 5 matches found
✅ search_by_vibe works!

Testing get_vibe_summary...
Restaurant ID: ...
Summary generated successfully
✅ get_vibe_summary works!
```

---

## Step 5: Test with Claude Desktop

### 5.1 Verify Claude Desktop Config

Check your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Should contain:
```json
{
  "mcpServers": {
    "vibe-search": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "...",
        "PINECONE_API_KEY": "...",
        "PINECONE_INDEX_NAME": "vibe-search",
        "DATABASE_URL": "..."
      }
    }
  }
}
```

### 5.2 Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Check MCP server connection (should show "vibe-search" connected)

### 5.3 Test Queries in Claude

Try these prompts in Claude Desktop:

**Test 1: Basic Vibe Search**
```
Use the search_by_vibe tool to find restaurants with a "dark moody bar" vibe
```

**Expected:** Should return 5 results with reviews matching that vibe

**Test 2: Different Vibe**
```
Find me restaurants with a "bright sunny cafe" atmosphere
```

**Expected:** Should return different results matching bright/sunny vibes

**Test 3: Get Vibe Summary**
```
Get a vibe summary for restaurant [use a restaurant_id from previous search]
```

**Expected:** Should return a natural language summary of the restaurant's vibe

---

## Step 6: Test Python Query Scripts

### 6.1 Test Interactive Query

```bash
cd ../data-pipeline
python3 interactive_query.py
```

**Try queries:**
- `dark moody bar`
- `romantic date night`
- `bright cheerful brunch`

**Expected:** Should return top 5 matching reviews with similarity scores

**Exit:** Type `quit` when done

---

## Step 7: Verify Data in Database (Optional)

### 7.1 Check Database Tables

```bash
cd ../mcp-server
npx prisma studio
```

**Check:**
- `places` table - Should be empty (data only in JSON, not DB yet)
- `reviews` table - Should be empty
- `photos` table - Should be empty

**Note:** Currently data is only in JSON files, not database. This is expected.

---

## Step 8: Test End-to-End Flow

### 8.1 Complete Pipeline Test

```bash
cd data-pipeline

# 1. Generate data
python3 scraper.py

# 2. Generate embeddings
python3 embedder.py

# 3. Upload to Pinecone
python3 upsert_pinecone.py

# 4. Test search
python3 interactive_query.py
# Try: "dark moody bar"
```

**Expected Flow:**
1. ✅ Data generated (5 restaurants, 100 reviews, 15 images)
2. ✅ Embeddings created (100 review + 15 image embeddings)
3. ✅ Pinecone updated (115 vectors)
4. ✅ Search returns relevant results

---

## Troubleshooting

### Issue: "No reviews found" in embedder

**Solution:**
```bash
# Check if reviews.json exists and has data
cat data/sample/reviews.json | jq '. | length'
# If 0, run scraper again
python3 scraper.py
```

### Issue: "IndexError: list index out of range" in upsert_pinecone

**Solution:** Already fixed! But if it happens:
```bash
# Check if embeddings exist
ls -lh data/embeddings/
# If empty, run embedder again
python3 embedder.py
```

### Issue: MCP server not connecting

**Solution:**
```bash
# Check Node version (needs >= 18)
node --version

# Rebuild server
cd mcp-server
npm run build

# Check logs
tail -50 logs/combined.log
```

### Issue: Pinecone query returns no results

**Solution:**
```bash
# Verify data in Pinecone
# Go to https://app.pinecone.io
# Check index "vibe-search"
# Should show ~115 vectors

# Re-upload if needed
python3 upsert_pinecone.py
```

---

## Success Criteria

✅ **All tests pass if:**
1. Scraper generates 5 restaurants, 100 reviews, 15 images
2. Embedder creates 100 review + 15 image embeddings
3. Pinecone has ~115 vectors uploaded
4. MCP server tools work (`search_by_vibe`, `get_vibe_summary`)
5. Claude Desktop can use the tools
6. Python query script returns relevant results

---

## Next Steps After Testing

Once everything works:

1. **Scale Up:**
   - Increase `NUM_RESTAURANTS` to 50-100
   - Generate more sample data

2. **Try Real Data:**
   - Wait for Foursquare rate limit to reset
   - Set `USE_FOURSQUARE=true` in `.env`
   - Run scraper with real SF restaurants

3. **Add Database Integration:**
   - Modify scraper to write to PostgreSQL
   - Store restaurants, photos, reviews in database

4. **Enhance Features:**
   - Add location filtering to search
   - Implement image-based search
   - Build decision layer (text vs image)

---

## Quick Reference

**Generate Sample Data:**
```bash
cd data-pipeline
python3 scraper.py
```

**Generate Embeddings:**
```bash
python3 embedder.py
```

**Upload to Pinecone:**
```bash
python3 upsert_pinecone.py
```

**Test Search:**
```bash
python3 interactive_query.py
```

**Test MCP Server:**
```bash
cd ../mcp-server
npm run test
```

**Check Database:**
```bash
npx prisma studio
```

---

## Time Estimate

- **Step 1-3 (Data Pipeline):** ~5-10 minutes
- **Step 4 (MCP Server):** ~2-3 minutes
- **Step 5 (Claude Desktop):** ~5 minutes
- **Step 6-7 (Additional Tests):** ~5 minutes

**Total:** ~20-25 minutes for full testing

Good luck! 🚀
