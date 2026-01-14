# Foursquare API Documentation Summary

## Official Documentation Links

- **Developer Portal**: https://foursquare.com/developer/
- **API Documentation**: https://docs.foursquare.com/developer/
- **Places API Overview**: https://foursquare.com/products/places-api/
- **Postman Collection**: https://github.com/foursquare/Place-API-Postman-Collection

## Key Findings from Documentation

### Free Tier Limits
- **10,000 calls** for testing select Pro API endpoints (one-time or monthly?)
- **Pay-as-you-go pricing** for production use
- Free tier allows testing, but production requires paid plan

### API Structure
The Places API has multiple endpoint groups:
1. **Search & Data Endpoints** - Search for places, get place IDs
2. **Geotagging Endpoints** - Geotag user content
3. **Placemaker Endpoints** - Contribute POI data
4. **Autocomplete Endpoints** - Real-time suggestions

### What's NOT Clearly Documented
- ❌ Specific rate limits per endpoint (search vs details)
- ❌ Requests per hour/minute/second limits
- ❌ Rate limit headers format
- ❌ Reset window timing
- ❌ Differences between free tier and paid tier limits

## What We Know from Testing

### Search Endpoint (`/places/search`)
- ✅ Works immediately
- ✅ No rate limit issues observed
- ✅ Returns restaurant list successfully

### Details Endpoint (`/places/{fsq_id}`)
- ❌ Gets 429 immediately
- ❌ Rate limited on first request
- ❌ Headers show `X-RateLimit-Limit: 0` (not provided)

## Likely Explanation

Based on the behavior:

1. **Free tier may have very strict limits on details endpoint**
   - Possibly only a few requests per hour
   - Or 1-2 requests per minute
   - Much stricter than search endpoint

2. **10,000 calls limit may be:**
   - Total across all endpoints
   - Or per month
   - Already exhausted from previous testing

3. **New Places API v3 (2025-02-05) may have:**
   - Different rate limits than v2
   - Stricter limits on data-heavy endpoints (details, photos, tips)
   - Different rate limit header format

## Recommended Actions

### 1. Check Developer Console
- Log into https://foursquare.com/developer/
- Check API usage dashboard
- See remaining quota/limits
- Check if 10,000 call limit is exhausted

### 2. Contact Foursquare Support
- Ask about specific rate limits for Places API v3
- Inquire about details endpoint limits
- Request rate limit header documentation

### 3. Review API Explorer
- Use https://docs.foursquare.com/developer/ API Explorer
- Test endpoints directly
- Check response headers for rate limit info

### 4. Check Postman Collection
- Download from GitHub
- Test endpoints with proper headers
- See if rate limits are documented in examples

## Alternative Solutions

### Option 1: Use Search Data Only
- Skip details endpoint entirely
- Use only data from search results
- Generate embeddings from names/descriptions

### Option 2: Upgrade to Paid Tier
- Pay-as-you-go pricing
- Higher rate limits
- Production-ready usage

### Option 3: Use Sample Data
- `USE_FOURSQUARE=false` for testing
- Full pipeline works without API limits
- Switch to real data later

### Option 4: Implement Caching
- Cache detail responses
- Avoid redundant API calls
- Respect cache headers if provided

## Next Steps

1. **Check Developer Console** for usage/quota
2. **Review Postman Collection** for rate limit examples
3. **Contact Support** if limits unclear
4. **Use sample data** for now to continue development

## References

- Foursquare Developer Portal: https://foursquare.com/developer/
- API Documentation: https://docs.foursquare.com/developer/
- Places API Product Page: https://foursquare.com/products/places-api/
- Postman Collection: https://github.com/foursquare/Place-API-Postman-Collection
