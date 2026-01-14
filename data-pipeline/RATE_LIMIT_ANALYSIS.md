# Foursquare API Rate Limit Analysis

## Problem

The scraper is **always hitting rate limits** on the details endpoint, even with delays.

## Findings

### What Works
- ✅ **Search endpoint** (`/places/search`) - Works fine, no rate limits
- ✅ Returns restaurant list successfully

### What Fails
- ❌ **Details endpoint** (`/places/{fsq_id}`) - Gets 429 immediately
- ❌ Every single detail request is rate limited
- ❌ Rate limit headers not provided (or show 0)

## Root Cause

**The new Foursquare Places API v3 has different rate limits per endpoint:**

1. **Search endpoint**: Higher limits (or no limits for basic queries)
2. **Details endpoint**: Much stricter limits
   - Possibly **1-2 requests per minute** (not per hour!)
   - Or very low hourly limit (like 10-20 requests/hour)
   - Free tier may severely restrict detail requests

## Evidence

From testing:
- Search: ✅ Works immediately
- Details: ❌ 429 on first request
- Headers: `X-RateLimit-Limit: 0` (not provided or not exposed)

## Solutions

### Option 1: Much Longer Delays (Current Fix)
```python
# Wait 30-60 seconds between detail requests
time.sleep(30)  # or 60 for safety
```

**Pros:**
- Simple fix
- Should work if limit is per-minute

**Cons:**
- Very slow (5 restaurants = 2.5-5 minutes)
- May still hit limits if hourly quota is low

### Option 2: Use Sample Data for Testing
```bash
# In .env
USE_FOURSQUARE=false
```

**Pros:**
- No rate limits
- Fast testing
- Full pipeline works

**Cons:**
- Not real data
- Need to switch back for production

### Option 3: Check Foursquare API Documentation
- Look up actual rate limits for Places API v3
- May need to upgrade to paid tier
- Or use different API endpoints

### Option 4: Skip Details, Use Search Data Only
- Use only data from search endpoint
- Skip photos/tips (which require details)
- Generate embeddings from restaurant names/descriptions only

**Pros:**
- No rate limit issues
- Fast scraping

**Cons:**
- No reviews/tips
- No photos
- Less data for embeddings

## Recommended Approach

**For Development/Testing:**
1. Use sample data (`USE_FOURSQUARE=false`)
2. Test full pipeline with sample data
3. Verify embeddings and Pinecone work

**For Production:**
1. Use longer delays (30-60 seconds)
2. Scrape in smaller batches (1-2 restaurants at a time)
3. Wait between batches (hours/days)
4. Or upgrade to paid Foursquare tier

## Current Status

- ✅ Search endpoint: Working
- ❌ Details endpoint: Rate limited
- ⚠️  Need to wait or use alternative approach

## Next Steps

1. **Immediate**: Use sample data to test pipeline
2. **Short-term**: Try 60-second delays between detail requests
3. **Long-term**: Check Foursquare API docs for actual v3 limits, consider paid tier
