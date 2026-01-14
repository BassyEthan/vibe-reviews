"""
Check Foursquare API rate limit status.
Shows remaining requests and when limits reset.
"""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("FOURSQUARE_API_KEY")
if not api_key:
    print("❌ FOURSQUARE_API_KEY not found in .env")
    exit(1)

# Make a simple test request to check rate limits
url = "https://places-api.foursquare.com/places/search"
headers = {
    "Authorization": f"Bearer {api_key}",
    "X-Places-Api-Version": "2025-02-05",
    "Accept": "application/json"
}
params = {
    "query": "restaurant",
    "ll": "37.7749,-122.4194",
    "radius": 100,
    "limit": 1  # Just 1 result to minimize usage
}

print("Checking Foursquare API rate limit status...")
print(f"API Key: {api_key[:10]}...{api_key[-5:]}")
print()

try:
    response = requests.get(url, headers=headers, params=params, timeout=10)
    
    # Check rate limit headers (try multiple header name variations)
    rate_limit_limit = response.headers.get('X-RateLimit-Limit') or response.headers.get('x-ratelimit-limit') or response.headers.get('RateLimit-Limit')
    rate_limit_remaining = response.headers.get('X-RateLimit-Remaining') or response.headers.get('x-ratelimit-remaining') or response.headers.get('RateLimit-Remaining')
    rate_limit_reset = response.headers.get('X-RateLimit-Reset') or response.headers.get('x-ratelimit-reset') or response.headers.get('RateLimit-Reset')
    retry_after = response.headers.get('Retry-After') or response.headers.get('retry-after')
    
    print("📊 Rate Limit Status:")
    print(f"   Limit: {rate_limit_limit or 'Not provided'}")
    print(f"   Remaining: {rate_limit_remaining or 'Not provided'}")
    print(f"   Reset Time: {rate_limit_reset or 'Not provided'}")
    print(f"   Retry After: {retry_after or 'Not provided'}")
    print()
    print("📋 All Response Headers:")
    for key, value in sorted(response.headers.items()):
        if 'rate' in key.lower() or 'limit' in key.lower() or 'retry' in key.lower():
            print(f"   {key}: {value}")
    print()
    
    if rate_limit_reset and rate_limit_reset != 'Not provided':
        reset_timestamp = int(rate_limit_reset)
        current_time = int(time.time())
        seconds_until_reset = reset_timestamp - current_time
        minutes_until_reset = seconds_until_reset / 60
        
        if seconds_until_reset > 0:
            print(f"⏰ Rate limit resets in: {int(minutes_until_reset)} minutes ({seconds_until_reset} seconds)")
        else:
            print("✅ Rate limit should be reset now")
    
    print()
    
    if response.status_code == 200:
        print("✅ API is responding successfully")
        data = response.json()
        print(f"   Found {len(data.get('results', []))} results")
    elif response.status_code == 429:
        print("❌ Rate limited (429)")
        print("   You've hit the rate limit. Wait for the reset time above.")
    else:
        print(f"⚠️  Unexpected status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        
except requests.RequestException as e:
    print(f"❌ Request failed: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"   Status: {e.response.status_code}")
        print(f"   Headers: {dict(e.response.headers)}")

# Test details endpoint (the one that's failing)
print("\n" + "="*60)
print("Testing Details Endpoint (the one that gets rate limited)...")
print("="*60)

details_url = "https://places-api.foursquare.com/places/54a8b5d1498ef8abe40ce6b3"  # Shizen restaurant
details_params = {
    "fields": "description,tel,website,social_media,hours,hours_popular,rating,price,menu,photos,tips,tastes,attributes,name,location,categories"
}

try:
    details_response = requests.get(details_url, headers=headers, params=details_params, timeout=10)
    
    print(f"Status Code: {details_response.status_code}")
    
    if details_response.status_code == 429:
        print("❌ DETAILS ENDPOINT IS RATE LIMITED")
        print("\n📋 Rate Limit Headers from Details Endpoint:")
        for key, value in sorted(details_response.headers.items()):
            if 'rate' in key.lower() or 'limit' in key.lower() or 'retry' in key.lower():
                print(f"   {key}: {value}")
        
        retry_after = details_response.headers.get('Retry-After') or details_response.headers.get('retry-after')
        if retry_after:
            print(f"\n⏰ Wait {retry_after} seconds before retrying")
    elif details_response.status_code == 200:
        print("✅ Details endpoint is working!")
        data = details_response.json()
        print(f"   Restaurant: {data.get('name', 'Unknown')}")
        print(f"   Has photos: {len(data.get('photos', []))} photos")
        print(f"   Has tips: {len(data.get('tips', []))} tips")
    else:
        print(f"⚠️  Unexpected status: {details_response.status_code}")
        print(f"   Response: {details_response.text[:200]}")
        
except requests.RequestException as e:
    print(f"❌ Details request failed: {e}")

print()
print("💡 Analysis:")
print("   - Search endpoint works (no rate limit)")
print("   - Details endpoint may have stricter limits")
print("   - New Places API v3 may not expose rate limit headers")
print("   - Try waiting 5-10 minutes between detail requests")
print("   - Or use sample data for testing: USE_FOURSQUARE=false")
