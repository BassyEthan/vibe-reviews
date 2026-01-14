# Restaurant Data Sources & Limits

## Clarification: Supabase vs Data Sources

**Supabase = Database Hosting (Storage)**
- Provides: PostgreSQL database hosting
- Does NOT provide: Restaurant data
- Purpose: Stores data you scrape from APIs

**Foursquare API = Restaurant Data Source**
- Provides: Restaurant listings, reviews (tips), photos
- Purpose: Where you GET the restaurant data from

---

## How Many Restaurants Can You Get?

### From Foursquare API (Your Current Source)

**Free Tier Limits:**
- **100,000 requests/month** (free tier)
- **50 restaurants per search request** (API limit)
- **Rate limit**: ~1,200 requests/hour

**San Francisco Coverage:**
- **Total restaurants in SF**: ~7,000+ restaurants
- **Searchable via API**: All of them (Foursquare has comprehensive coverage)

**Practical Limits Based on Your Code:**

1. **Single Search Request:**
   ```python
   search_results = self.search_restaurants(limit=min(num_restaurants, 50))
   ```
   - Maximum: **50 restaurants per request**
   - Current setting: `NUM_RESTAURANTS=5` (for testing)

2. **Multiple Requests (Pagination):**
   - You can make multiple search requests with different coordinates
   - Each request: 50 restaurants
   - Example: 20 requests = 1,000 restaurants
   - But: Each restaurant needs 1 detail request (for photos/tips)
   - Total requests: 1 search + 1 detail per restaurant

3. **Monthly Limit Calculation:**
   ```
   Free tier: 100,000 requests/month
   
   To scrape 1,000 restaurants:
   - 20 search requests (20 requests)
   - 1,000 detail requests (1,000 requests)
   - Total: ~1,020 requests
   
   Monthly capacity: ~98,000 restaurants possible
   (But you'd need to paginate through SF with multiple coordinate searches)
   ```

### Current Implementation Limits

**Code Limitation:**
```python
# In scraper.py line 287
search_results = self.search_restaurants(limit=min(num_restaurants, 50))
```
- Hard limit: **50 per search** (Foursquare API limit)
- Current config: **5 restaurants** (for testing)

**To Get More Restaurants:**

1. **Increase NUM_RESTAURANTS:**
   ```bash
   # In .env
   NUM_RESTAURANTS=100  # Will make 2 search requests (50 + 50)
   ```

2. **Implement Pagination:**
   - Make multiple search requests with different coordinates
   - SF is ~7x7 miles, you can divide into grid
   - Each grid cell: 50 restaurants
   - Example: 10x10 grid = 5,000 restaurants possible

3. **Use Multiple Search Queries:**
   - Search "restaurant" (general)
   - Search "bar" (specific)
   - Search "cafe" (specific)
   - Search "diner" (specific)
   - Combine results (deduplicate by fsq_place_id)

---

## Database Storage (Supabase)

**Supabase Free Tier:**
- **500 MB database storage**
- **Unlimited rows** (within storage limit)
- **2 GB bandwidth/month**

**Storage Calculation:**
```
Per restaurant:
- Place record: ~500 bytes
- 10 reviews: ~5 KB
- 5 photos: ~1 KB (metadata only, URLs stored)
- Total: ~6.5 KB per restaurant

500 MB = 500,000 KB
500,000 KB / 6.5 KB = ~76,000 restaurants possible
```

**Conclusion:** Supabase free tier can store **thousands of restaurants** easily.

---

## Recommended Approach

### Phase 1: Start Small (Current)
- **5-10 restaurants** (testing)
- Validate pipeline works
- Test embeddings and search

### Phase 2: Expand to SF Coverage
- **100-500 restaurants** (good coverage)
- Focus on popular/well-reviewed places
- Multiple search queries (restaurant, bar, cafe, etc.)

### Phase 3: Full SF Coverage
- **1,000-2,000 restaurants** (comprehensive)
- Grid-based pagination
- Multiple cuisine types
- Use all 100k monthly requests efficiently

---

## How to Increase Restaurant Count

### Option 1: Simple Increase
```bash
# In data-pipeline/.env
NUM_RESTAURANTS=100
```
- Makes 2 search requests (50 + 50)
- Gets 100 restaurants
- Uses ~102 API requests (2 search + 100 details)

### Option 2: Multiple Search Queries
Modify `scraper.py` to search multiple terms:
```python
search_terms = ["restaurant", "bar", "cafe", "diner", "bistro"]
for term in search_terms:
    results = self.search_restaurants(query=term, limit=50)
    # Combine and deduplicate
```

### Option 3: Grid-Based Pagination
Divide SF into grid cells:
```python
# SF bounding box
lat_min, lat_max = 37.7, 37.8
lon_min, lon_max = -122.5, -122.4

# Create grid
for lat in range(lat_min, lat_max, 0.01):  # ~0.6 mile cells
    for lon in range(lon_min, lon_max, 0.01):
        results = self.search_restaurants(ll=f"{lat},{lon}", radius=5000)
```

---

## Summary

**Supabase provides:**
- ❌ Zero restaurants (it's just database hosting)
- ✅ Storage for thousands of restaurants

**Foursquare API provides:**
- ✅ Access to ~7,000+ SF restaurants
- ✅ Free tier: 100,000 requests/month
- ✅ 50 restaurants per search request
- ✅ Current code limit: 50 per search (can paginate)

**Practical limits:**
- **Current**: 5 restaurants (testing)
- **Easy**: 100-500 restaurants (single search queries)
- **Advanced**: 1,000-2,000+ restaurants (pagination)
- **Maximum**: ~98,000 restaurants/month (theoretical, with efficient pagination)

**Recommendation:** Start with 100-200 restaurants to get good coverage of SF's popular spots, then expand as needed.
