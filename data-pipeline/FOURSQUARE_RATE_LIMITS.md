# Foursquare API Rate Limits (Official Documentation)

## Rate Limit Overview

### Userless Requests (API Key Authentication)

1. **Venues/* endpoints**: **5,000 requests/hour**
   - Examples: `/venues/search`, `/venues/explore`
   - **Places API v3**: `/places/search` likely falls here

2. **Other endpoint groups**: **500 requests/hour**
   - Examples: `/tips/*`, `/photos/*`
   - **Places API v3**: `/places/{fsq_id}` (details) likely falls here

### Authenticated Requests (OAuth)

- **500 requests/hour per OAuth token**
- If your app has 3 connected users: 500 × 3 = 1,500 requests/hour max

## Key Points

### Rate Limits Are Per Endpoint Group, Not Per Endpoint

**Example:**
- In 1 hour, you can make:
  - 2,500 requests to `/venues/search` 
  - 2,500 requests to `/venues/explore`
  - **Total: 5,000 requests to venues/* group** ✅
  - Still have 500 requests left for `/tips/*` group ✅

### Error Responses

- **Status Code**: `403` (not 429) when rate limited
- **Response Body**: Empty
- **Headers**: 
  - `X-RateLimit-Reset` - Timestamp when limits reset
  - `X-RateLimit-Remaining` - Requests remaining
  - `X-RateLimit-Limit` - Total limit

## Why Your Scraper Is Failing

### The Problem

1. **Search endpoint** (`/places/search`):
   - Likely in "venues/*" group
   - Limit: **5,000/hour** ✅
   - Works fine (plenty of quota)

2. **Details endpoint** (`/places/{fsq_id}`):
   - Likely in "other endpoints" group
   - Limit: **500/hour** ❌
   - Gets rate limited immediately

### What Happened

- You made multiple detail requests
- Each restaurant needs 1 detail request
- 5 restaurants = 5 requests
- But if you ran the scraper multiple times, you likely exhausted the 500/hour limit
- Now every detail request gets 403/429 immediately

## Solutions

### Option 1: Wait for Hourly Reset

```bash
# Check when rate limit resets
# Look for X-RateLimit-Reset header in error response
# Wait until that timestamp
```

### Option 2: Reduce Request Frequency

```python
# Current: 30 seconds between requests
# For 500/hour limit: Need 7.2 seconds between requests minimum
# Use 10-15 seconds to be safe
time.sleep(15)  # Between detail requests
```

### Option 3: Use Sample Data

```bash
# Skip Foursquare API entirely for testing
USE_FOURSQUARE=false python3 scraper.py
```

### Option 4: Batch Requests Strategically

- Make all search requests first (5,000/hour limit)
- Then make detail requests slowly (500/hour limit)
- Space detail requests 10-15 seconds apart

## Recommended Approach

### For Development/Testing

**Use sample data:**
```bash
USE_FOURSQUARE=false python3 scraper.py
python3 embedder.py
python3 upsert_pinecone.py
```

### For Production

**Respect rate limits:**
```python
# Wait 10-15 seconds between detail requests
# 500 requests/hour = 1 request per 7.2 seconds
# Use 15 seconds to be safe
time.sleep(15)

# Check headers before each request
# Stop if X-RateLimit-Remaining < 10
```

## Current Code Status

✅ **Updated** to:
- Handle both 403 and 429 status codes
- Check `X-RateLimit-Reset` header
- Use exponential backoff with minimum 60 seconds
- Log rate limit information

## Rate Limit Calculation

### Details Endpoint (500/hour limit)

- **Maximum requests**: 500/hour
- **Minimum delay**: 7.2 seconds between requests
- **Recommended delay**: 10-15 seconds (safe buffer)
- **Time to scrape 100 restaurants**: ~15-25 minutes

### Search Endpoint (5,000/hour limit)

- **Maximum requests**: 5,000/hour
- **Minimum delay**: 0.72 seconds between requests
- **Recommended delay**: 1-2 seconds
- **Time to search 100 restaurants**: ~2-3 minutes

## References

- Official Docs: https://docs.foursquare.com/developer/reference/v2-rate-limits
- Check headers: `X-RateLimit-Remaining`, `X-RateLimit-Limit`, `X-RateLimit-Reset`
