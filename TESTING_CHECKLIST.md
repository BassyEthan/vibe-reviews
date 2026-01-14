# Quick Testing Checklist

## ✅ Pre-Flight Check (2 min)

- [ ] `cd data-pipeline && cat .env | grep OPENAI_API_KEY` (should show key)
- [ ] `cat .env | grep PINECONE_API_KEY` (should show key)
- [ ] `cat .env | grep USE_FOURSQUARE` (should be false or not set)

---

## 🚀 Main Pipeline (10 min)

### Step 1: Generate Data
```bash
cd data-pipeline
python3 scraper.py
```
- [ ] Output shows: `restaurants=5 reviews=100 images=15`
- [ ] Files exist: `data/sample/restaurants.json`, `reviews.json`, `images.json`

### Step 2: Generate Embeddings
```bash
python3 embedder.py
```
- [ ] Output shows: `Processed reviews count=100`
- [ ] Output shows: `Processed images count=15`
- [ ] Files exist: `data/embeddings/review_embeddings.json`, `image_embeddings.json`

### Step 3: Upload to Pinecone
```bash
python3 upsert_pinecone.py
```
- [ ] Output shows: `All reviews upserted total=100`
- [ ] Output shows: `All images upserted total=15`
- [ ] No errors

---

## 🔍 Test Search (5 min)

### Test Python Query
```bash
python3 interactive_query.py
```
- [ ] Type: `dark moody bar`
- [ ] Returns 5 results with scores
- [ ] Results make sense (dark/moody reviews)
- [ ] Type `quit` to exit

---

## 🤖 Test MCP Server (5 min)

### Build & Test
```bash
cd ../mcp-server
npm run build
npm run test
```
- [ ] Build succeeds (no errors)
- [ ] Test shows: `✅ search_by_vibe works!`
- [ ] Test shows: `✅ get_vibe_summary works!`

### Test with Claude Desktop
- [ ] Restart Claude Desktop
- [ ] MCP server shows as connected
- [ ] Try: "Use search_by_vibe to find dark moody bars"
- [ ] Claude returns restaurant results
- [ ] Try: "Get vibe summary for [restaurant_id]"
- [ ] Claude returns summary

---

## ✅ Success Criteria

- [ ] 5 restaurants, 100 reviews, 15 images generated
- [ ] 100 review + 15 image embeddings created
- [ ] 115 vectors in Pinecone
- [ ] Python query script works
- [ ] MCP server tools work
- [ ] Claude Desktop can use tools

---

## 🐛 If Something Fails

**No data?**
```bash
python3 scraper.py  # Run again
```

**No embeddings?**
```bash
python3 embedder.py  # Run again
```

**Pinecone empty?**
```bash
python3 upsert_pinecone.py  # Re-upload
```

**MCP server error?**
```bash
cd mcp-server
npm run build  # Rebuild
tail -50 logs/combined.log  # Check logs
```

---

## 📝 Notes

- Full guide: See `TESTING_GUIDE.md`
- Time: ~20-25 minutes total
- All data is sample data (not real Foursquare)
- Database is optional (data in JSON files works fine)
