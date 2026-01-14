# Technical Pipeline: Vibe-Reviews System

## Overview
This document describes the functional pipeline of the Vibe-Reviews system, showing how data flows from ingestion to query execution.

---

## Pipeline 1: Data Ingestion & Embedding

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA INGESTION PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────┘

1. SCRAPER (scraper.py)
   │
   ├─→ Foursquare Places API v3
   │   ├─→ GET /places/search?query=restaurant&ll=37.7749,-122.4194
   │   │   └─→ Returns: [restaurant1, restaurant2, ...]
   │   │
   │   └─→ For each restaurant:
   │       ├─→ GET /places/{fsq_id}?fields=photos,tips,rating,...
   │       │   └─→ Returns: {name, location, categories, photos[], tips[], rating}
   │       │
   │       └─→ Rate Limiting: 2s delay before details, 0.1s between restaurants
   │
   ├─→ Data Transformation
   │   ├─→ Restaurant: fsq_place_id → UUID, extract name/location/cuisine
   │   ├─→ Reviews: tips[] → Review objects (text, rating, author, date)
   │   └─→ Images: photos[] → Image objects (url from prefix+suffix)
   │
   └─→ Output: JSON Files
       ├─→ data/sample/restaurants.json
       ├─→ data/sample/reviews.json
       └─→ data/sample/images.json

2. EMBEDDER (embedder.py)
   │
   ├─→ Input Source (Priority Order):
   │   1. PostgreSQL Database (if DATABASE_URL set)
   │   2. JSON Files (data/sample/*.json)
   │
   ├─→ TEXT EMBEDDING (TextEmbedder)
   │   │
   │   ├─→ For each review:
   │   │   ├─→ OpenAI API Call
   │   │   │   POST https://api.openai.com/v1/embeddings
   │   │   │   {
   │   │   │     "model": "text-embedding-3-small",
   │   │   │     "input": review.text,
   │   │   │     "dimensions": 512
   │   │   │   }
   │   │   │
   │   │   └─→ Returns: [0.123, -0.456, ..., 0.789] (512-dim vector)
   │   │
   │   └─→ Batch Processing: 100 reviews per API call
   │
   ├─→ IMAGE EMBEDDING (ImageEmbedder)
   │   │
   │   ├─→ For each image:
   │   │   │
   │   │   ├─→ ImageDownloader.get_restaurant_image_url()
   │   │   │   ├─→ If Foursquare URL exists → use it
   │   │   │   └─→ Else → Pexels API (keyword-based selection)
   │   │   │
   │   │   ├─→ Download Image
   │   │   │   GET {image_url}
   │   │   │   └─→ Returns: Image bytes
   │   │   │
   │   │   ├─→ CLIP Model Processing
   │   │   │   ├─→ Load CLIP ViT-B/32 (lazy load, first time only)
   │   │   │   ├─→ Preprocess: PIL Image → Tensor
   │   │   │   ├─→ Encode: model.encode_image(tensor)
   │   │   │   ├─→ Normalize: features / ||features||
   │   │   │   └─→ Returns: [0.234, -0.123, ..., 0.456] (512-dim vector)
   │   │   │
   │   │   └─→ Rate Limiting: 0.5s delay between images
   │   │
   │   └─→ Error Handling: Returns [0.0, ..., 0.0] on failure
   │
   └─→ Output: JSON Files
       ├─→ data/embeddings/review_embeddings.json
       │   [
       │     {
       │       "id": "review-uuid",
       │       "restaurant_id": "restaurant-uuid",
       │       "text": "Dark and moody atmosphere...",
       │       "embedding": [0.123, -0.456, ...],
       │       "metadata": {rating: 4.5, author: "User1", date: "2024-01-15"}
       │     },
       │     ...
       │   ]
       │
       └─→ data/embeddings/image_embeddings.json
           [
             {
               "id": "image-uuid",
               "restaurant_id": "restaurant-uuid",
               "url": "https://...",
               "embedding": [0.234, -0.123, ...],
               "metadata": {description: "Photo of Restaurant Name"}
             },
             ...
           ]

3. UPSERTER (upsert_pinecone.py)
   │
   ├─→ Pinecone Connection
   │   ├─→ Initialize: Pinecone(api_key=PINECONE_API_KEY)
   │   └─→ Index: pc.Index("vibe-search")
   │
   ├─→ Index Creation (if not exists)
   │   ├─→ Dimension: 512 (unified for text + images)
   │   ├─→ Metric: cosine
   │   └─→ Spec: ServerlessSpec(cloud="aws", region="us-east-1")
   │
   ├─→ Review Embeddings Upsert
   │   ├─→ Read: data/embeddings/review_embeddings.json
   │   ├─→ Transform: Each review → Vector object
   │   │   {
   │   │     "id": "review_{review_id}",
   │   │     "values": [0.123, -0.456, ...],  // 512-dim embedding
   │   │     "metadata": {
   │   │       "type": "review",
   │   │       "restaurant_id": "...",
   │   │       "text": "...",
   │   │       "rating": 4.5,
   │   │       "author": "...",
   │   │       "date": "..."
   │   │     }
   │   │   }
   │   │
   │   └─→ Batch Upsert: 100 vectors per batch
   │
   ├─→ Image Embeddings Upsert
   │   ├─→ Read: data/embeddings/image_embeddings.json
   │   ├─→ Validate: Skip if all zeros (placeholder)
   │   ├─→ Transform: Each image → Vector object
   │   │   {
   │   │     "id": "image_{image_id}",
   │   │     "values": [0.234, -0.123, ...],  // 512-dim CLIP embedding
   │   │     "metadata": {
   │   │       "type": "image",
   │   │       "restaurant_id": "...",
   │   │       "url": "https://..."
   │   │     }
   │   │   }
   │   │
   │   └─→ Batch Upsert: 100 vectors per batch
   │
   └─→ Result: Pinecone Index "vibe-search"
       ├─→ Contains: review vectors + image vectors
       ├─→ Dimension: 512 (unified)
       └─→ Metadata: Enables filtering by type, restaurant_id, etc.
```

### Technical Components

**1. Scraper (`scraper.py`)**
- **Class**: `FoursquareScraper`
- **API**: Foursquare Places API v3
- **Base URL**: `https://places-api.foursquare.com`
- **Authentication**: Bearer token in `Authorization` header
- **Rate Limiting**: 2s before details, 0.1s between restaurants
- **Error Handling**: Exponential backoff for 429 errors

**2. Embedder (`embedder.py`)**
- **Text Embedder**:
  - Model: `text-embedding-3-small` (OpenAI)
  - Dimensions: 512
  - Batch Size: 100
  - API: `POST /v1/embeddings`
  
- **Image Embedder**:
  - Model: CLIP ViT-B/32 (PyTorch)
  - Dimensions: 512
  - Lazy Loading: Model loads on first use
  - Normalization: L2 normalization applied
  
- **Image Downloader**:
  - Primary: Foursquare photo URLs
  - Fallback: Pexels API (keyword-based)
  - Rate Limiting: 0.5s between downloads

**3. Upserter (`upsert_pinecone.py`)**
- **Index**: `vibe-search` (Serverless)
- **Dimension**: 512 (unified)
- **Metric**: Cosine similarity
- **Batch Size**: 100 vectors
- **Vector IDs**: `review_{id}` or `image_{id}`

---

## Pipeline 2: Query Execution (MCP Server)

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    QUERY EXECUTION PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────┘

USER QUERY: "Find me a dark moody bar for date night"
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CLAUDE DESKTOP (or other MCP client)                                    │
│  └─→ JSON-RPC over stdio                                                 │
│      {                                                                   │
│        "jsonrpc": "2.0",                                                 │
│        "method": "tools/call",                                           │
│        "params": {                                                        │
│          "name": "search_by_vibe",                                        │
│          "arguments": {                                                    │
│            "query": "dark moody bar for date night",                      │
│            "limit": 5                                                     │
│          }                                                                │
│        }                                                                 │
│      }                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP SERVER (mcp-server/src/server.ts)                                   │
│  └─→ StdioServerTransport                                                │
│      └─→ VibeSearchMCPServer.setupHandlers()                             │
│          └─→ CallToolRequestSchema handler                               │
│              └─→ Routes to: searchByVibe()                               │
└─────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TOOL: search_by_vibe (mcp-server/src/tools/search-by-vibe.ts)          │
│  │                                                                       │
│  ├─→ Step 1: Generate Query Embedding                                    │
│  │   │                                                                    │
│  │   └─→ OpenAIService.generateEmbedding()                              │
│  │       ├─→ POST https://api.openai.com/v1/embeddings                  │
│  │       │   {                                                           │
│  │       │     "model": "text-embedding-3-small",                       │
│  │       │     "input": "dark moody bar for date night",                 │
│  │       │     "dimensions": 512                                         │
│  │       │   }                                                           │
│  │       │                                                               │
│  │       └─→ Returns: [0.234, -0.567, ..., 0.123] (512-dim)             │
│  │                                                                       │
│  ├─→ Step 2: Build Filter                                               │
│  │   │                                                                    │
│  │   └─→ Filter: { type: { $eq: "review" } }                            │
│  │       └─→ Note: location filter not implemented yet                  │
│  │                                                                       │
│  ├─→ Step 3: Query Pinecone                                              │
│  │   │                                                                    │
│  │   └─→ PineconeService.queryByVector()                                 │
│  │       ├─→ index.query({                                               │
│  │       │     vector: [0.234, -0.567, ...],                            │
│  │       │     topK: 5,                                                  │
│  │       │     includeMetadata: true,                                    │
│  │       │     filter: { type: { $eq: "review" } }                       │
│  │       │   })                                                          │
│  │       │                                                               │
│  │       └─→ Returns: Top 5 matches with cosine similarity scores       │
│  │           [                                                            │
│  │             {                                                          │
│  │               id: "review_123",                                       │
│  │               score: 0.89,                                             │
│  │               metadata: {                                              │
│  │                 restaurant_id: "rest_456",                            │
│  │                 text: "Dark and moody atmosphere...",                 │
│  │                 rating: 4.5,                                          │
│  │                 author: "User1",                                      │
│  │                 date: "2024-01-15"                                   │
│  │               }                                                        │
│  │             },                                                         │
│  │             ...                                                        │
│  │           ]                                                            │
│  │                                                                       │
│  └─→ Step 4: Format Output                                               │
│      │                                                                    │
│      └─→ Returns: SearchByVibeOutput                                    │
│          {                                                               │
│            results: [                                                     │
│              {                                                            │
│                restaurant_id: "rest_456",                                 │
│                text: "Dark and moody atmosphere...",                    │
│                score: 0.89,                                              │
│                rating: 4.5,                                              │
│                author: "User1",                                           │
│                date: "2024-01-15"                                        │
│              },                                                           │
│              ...                                                          │
│            ],                                                             │
│            query: "dark moody bar for date night",                        │
│            total_results: 5                                              │
│          }                                                               │
└─────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RESPONSE TO CLAUDE                                                      │
│  └─→ JSON-RPC Response                                                   │
│      {                                                                   │
│        "jsonrpc": "2.0",                                                 │
│        "result": {                                                        │
│          "content": [                                                    │
│            {                                                              │
│              "type": "text",                                             │
│              "text": "{...formatted JSON results...}"                    │
│            }                                                              │
│          ]                                                                │
│        }                                                                 │
│      }                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technical Components

**1. MCP Server (`server.ts`)**
- **Transport**: StdioServerTransport (stdin/stdout)
- **Protocol**: JSON-RPC 2.0
- **Tools Registered**: `search_by_vibe`, `get_vibe_summary`
- **Error Handling**: `handleToolError()` wrapper

**2. Search Tool (`search-by-vibe.ts`)**
- **Input Schema**: Zod validation
  ```typescript
  {
    query: string (required),
    location?: string (optional, not implemented),
    limit?: number (default: 5)
  }
  ```
- **Output Schema**:
  ```typescript
  {
    results: Array<{
      restaurant_id: string,
      text: string,
      score: number,
      rating: number,
      author: string,
      date: string
    }>,
    query: string,
    total_results: number
  }
  ```

**3. Services**
- **OpenAIService**: Handles embedding generation
- **PineconeService**: Handles vector queries
  - `queryByVector()`: Semantic search
  - `queryByRestaurantId()`: Filter by restaurant

---

## Pipeline 3: RAG Summary Generation

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RAG SUMMARY PIPELINE                                  │
└─────────────────────────────────────────────────────────────────────────┘

USER REQUEST: "Get vibe summary for restaurant XYZ"
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TOOL: get_vibe_summary (mcp-server/src/tools/get-vibe-summary.ts)     │
│  │                                                                       │
│  └─→ RAGService.generateVibeSummary(restaurantId)                        │
│      │                                                                   │
│      ├─→ Step 1: Retrieve Reviews                                       │
│      │   │                                                               │
│      │   └─→ PineconeService.queryByRestaurantId()                      │
│      │       ├─→ Query with dummy vector + filter                       │
│      │       │   {                                                      │
│      │       │     vector: [0.1, 0.1, ..., 0.1],  // 512-dim dummy      │
│      │       │     topK: 100,                                           │
│      │       │     filter: {                                             │
│      │       │       type: { $eq: "review" },                           │
│      │       │       restaurant_id: { $eq: "rest_xyz" }                 │
│      │       │     }                                                     │
│      │       │   }                                                       │
│      │       │                                                           │
│      │       └─→ Returns: Top 10 reviews for restaurant                  │
│      │                                                                   │
│      ├─→ Step 2: Prepare Context                                        │
│      │   │                                                               │
│      │   └─→ Format reviews as context strings                          │
│      │       "Review (Rating: 4.5/5 by User1 on 2024-01-15):            │
│      │        Dark and moody atmosphere, perfect for date night..."      │
│      │                                                                   │
│      ├─→ Step 3: Generate Summary                                        │
│      │   │                                                               │
│      │   └─→ OpenAIService.generateCompletion()                         │
│      │       ├─→ POST https://api.openai.com/v1/chat/completions        │
│      │       │   {                                                       │
│      │       │     "model": "gpt-4" (or gpt-3.5-turbo),                 │
│      │       │     "messages": [                                        │
│      │       │       {                                                   │
│      │       │         "role": "system",                                 │
│      │       │         "content": "You are a restaurant vibe analyst..." │
│      │       │       },                                                  │
│      │       │       {                                                   │
│      │       │         "role": "user",                                   │
│      │       │         "content": "Based on reviews...generate Vibe..." │
│      │       │       },                                                  │
│      │       │       {                                                   │
│      │       │         "role": "assistant",                             │
│      │       │         "content": "Review 1: ...\nReview 2: ..."        │
│      │       │       }                                                   │
│      │       │     ]                                                     │
│      │       │   }                                                       │
│      │       │                                                           │
│      │       └─→ Returns: Natural language summary                      │
│      │           "This intimate bar exudes a dark, moody ambiance       │
│      │            perfect for romantic evenings. Dim lighting and        │
│      │            exposed brick create an atmospheric setting ideal       │
│      │            for deep conversations over craft cocktails."          │
│      │                                                                   │
│      └─→ Step 4: Format Response                                        │
│          │                                                               │
│          └─→ Returns: VibeSummary                                       │
│              {                                                           │
│                restaurant_id: "rest_xyz",                              │
│                summary: "This intimate bar...",                         │
│                review_count: 10,                                        │
│                sources: [                                                │
│                  {text: "...", rating: 4.5, author: "User1", ...},     │
│                  ...                                                     │
│                ]                                                         │
│              }                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technical Components

**1. RAG Service (`rag.service.ts`)**
- **Retrieval**: Top 10 reviews from Pinecone
- **Generation**: OpenAI GPT-4 or GPT-3.5-turbo
- **System Prompt**: Defines "Vibe Report" format
- **Context Window**: All 10 reviews included

**2. Summary Format**
- **Length**: 3-4 sentences
- **Focus Areas**:
  1. Atmosphere & Ambiance
  2. Mood & Energy
  3. Ideal Occasions
  4. Unique Characteristics

---

## Data Structures

### Vector Metadata (Pinecone)

**Review Vector:**
```json
{
  "id": "review_abc123",
  "values": [0.123, -0.456, ..., 0.789],  // 512-dim
  "metadata": {
    "type": "review",
    "restaurant_id": "rest_xyz789",
    "text": "Dark and moody atmosphere...",
    "rating": 4.5,
    "author": "User1",
    "date": "2024-01-15"
  }
}
```

**Image Vector:**
```json
{
  "id": "image_def456",
  "values": [0.234, -0.123, ..., 0.456],  // 512-dim CLIP
  "metadata": {
    "type": "image",
    "restaurant_id": "rest_xyz789",
    "url": "https://..."
  }
}
```

### API Request/Response Examples

**Foursquare Search:**
```http
GET https://places-api.foursquare.com/places/search?query=restaurant&ll=37.7749,-122.4194&radius=5000&limit=50
Authorization: Bearer {API_KEY}
X-Places-Api-Version: 2025-02-05
```

**OpenAI Embedding:**
```http
POST https://api.openai.com/v1/embeddings
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "model": "text-embedding-3-small",
  "input": "dark moody bar for date night",
  "dimensions": 512
}
```

**Pinecone Query:**
```http
POST https://vibe-search-xxx.svc.us-east-1.pinecone.io/query
Api-Key: {API_KEY}

{
  "vector": [0.123, -0.456, ..., 0.789],
  "topK": 5,
  "includeMetadata": true,
  "filter": {
    "type": {"$eq": "review"}
  }
}
```

---

## Performance Characteristics

### Latency Estimates

**Data Ingestion:**
- Foursquare API: ~200ms per restaurant (with rate limiting)
- Text Embedding: ~50ms per batch of 100 reviews
- Image Embedding: ~500ms per image (CLIP processing)
- Pinecone Upsert: ~100ms per batch of 100 vectors

**Query Execution:**
- Query Embedding: ~200ms (OpenAI API)
- Pinecone Search: ~50-100ms (vector similarity)
- Total Query Time: ~300-400ms

**RAG Summary:**
- Review Retrieval: ~100ms (Pinecone filter)
- LLM Generation: ~1-2s (GPT-4) or ~500ms (GPT-3.5-turbo)
- Total Summary Time: ~1.1-2.1s

### Rate Limits

- **Foursquare**: 100,000 requests/month (free tier)
- **OpenAI Embeddings**: Varies by tier (typically 300 RPM)
- **OpenAI Completions**: Varies by tier
- **Pinecone**: Serverless (pay-per-use, no hard limits)

---

## Error Handling & Resilience

### Scraper
- **429 Rate Limit**: Exponential backoff (2s, 4s, 8s)
- **Missing Data**: Continues processing, logs warning
- **API Failures**: Retries 3 times, then skips restaurant

### Embedder
- **CLIP Load Failure**: Returns zero vector, logs warning
- **Image Download Failure**: Returns zero vector, logs error
- **OpenAI API Failure**: Raises exception, stops batch

### MCP Server
- **Tool Errors**: Wrapped in `handleToolError()`, returns JSON-RPC error
- **Service Failures**: Logged, error propagated to client
- **Validation Errors**: Zod schema validation, returns 400 error

---

## Current Limitations

1. **Location Filtering**: Parameter accepted but not implemented
2. **Image Search**: No `search_by_image_vibe` tool yet
3. **Decision Layer**: No automatic text vs image selection
4. **Reviews Scraping**: May be empty (needs debugging)
5. **Database**: Optional, not fully integrated into all flows

---

## Next Steps for Enhancement

1. **Implement Location Filtering**: Add location metadata to vectors
2. **Add Image Search Tool**: `search_by_image_vibe` using CLIP embeddings
3. **Build Decision Layer**: Automatically choose text vs image search
4. **Fix Reviews Scraping**: Debug Foursquare tips extraction
5. **Database Integration**: Make PostgreSQL primary source for all operations
