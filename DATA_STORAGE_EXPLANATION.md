# Data Storage: How Data Persists in Your System

## Current State

### What Happens Now

**When you run `scraper.py`:**
1. ✅ Scrapes restaurants from Foursquare
2. ✅ Saves to **JSON files only** (`data/sample/*.json`)
3. ❌ **Does NOT write to database** (currently)

**When you run `embedder.py`:**
1. ✅ Reads from JSON files (or database if `DATABASE_URL` set)
2. ✅ Generates embeddings
3. ✅ Saves embeddings to JSON files
4. ❌ **Does NOT write to database** (currently)

**When you run `upsert_pinecone.py`:**
1. ✅ Reads embeddings from JSON files
2. ✅ Uploads to **Pinecone** (vector database)
3. ❌ **Does NOT write to PostgreSQL** (currently)

## Database Schema Design

Looking at your Prisma schema, here's how data **would** be stored if you add database integration:

### 1. Places (Restaurants) - **PERMANENT** ✅

```prisma
model Place {
  // No expiration fields
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  // Comment says: "Permanent Cache (Foursquare Data)"
}
```

**Storage**: **Forever** - No expiration, stored permanently

### 2. Photos - **PERMANENT** ✅

```prisma
model Photo {
  created_at      DateTime @default(now())
  // No expiration fields
  // Comment says: "Permanent Cache (Google Places)"
}
```

**Storage**: **Forever** - No expiration, stored permanently

### 3. Reviews - **TEMPORARY (30-90 days)** ⏰

```prisma
model Review {
  created_at      DateTime @default(now())
  expires_at      DateTime  // Set to created_at + 30-90 days
  is_expired      Boolean  @default(false)
  // Comment says: "TTL Cache (30-90 days)"
}
```

**Storage**: **30-90 days**, then marked as `is_expired = true`
- Still in database, but filtered out in queries
- `embedder.py` already filters: `WHERE r.is_expired = false`

## What This Means

### If You Add Database Integration:

**Restaurants/Places:**
- ✅ Stored **forever** in database
- ✅ Permanent cache
- ✅ Won't expire

**Photos:**
- ✅ Stored **forever** in database
- ✅ Permanent cache
- ✅ Won't expire

**Reviews:**
- ⏰ Stored for **30-90 days**
- ⏰ Then marked as expired (but not deleted)
- ⏰ Filtered out from queries after expiration
- ⏰ You'd need to re-scrape to get fresh reviews

## Current Flow (No Database)

```
scraper.py
  ↓
JSON files (data/sample/*.json)
  ↓
embedder.py (reads JSON)
  ↓
JSON embeddings (data/embeddings/*.json)
  ↓
upsert_pinecone.py
  ↓
Pinecone (vector database)
```

**No data goes to PostgreSQL currently!**

## Future Flow (With Database)

```
scraper.py
  ↓
PostgreSQL (places, photos, reviews)
  ↓
embedder.py (reads from database)
  ↓
JSON embeddings (or could store in DB)
  ↓
upsert_pinecone.py
  ↓
Pinecone (vector database)
```

## Why Reviews Expire

**Design Rationale:**
- Reviews change over time (new reviews added, old ones become less relevant)
- Keeps data fresh and current
- Reduces storage costs
- Matches real-world review freshness

**Implementation:**
- When scraping, set `expires_at = created_at + 60 days` (or 30-90)
- Query filters: `WHERE is_expired = false`
- Expired reviews still in DB (for history), but not used in search

## Summary

**Current State:**
- ❌ Data goes to JSON files, NOT database
- ❌ No permanent storage in PostgreSQL
- ✅ Data goes to Pinecone (for search)

**If Database Integration Added:**
- ✅ Restaurants: **Permanent** (forever)
- ✅ Photos: **Permanent** (forever)
- ⏰ Reviews: **Temporary** (30-90 days, then expired)

**To Add Database Integration:**
You'd need to modify `scraper.py` to write to PostgreSQL using Prisma or raw SQL after scraping.
