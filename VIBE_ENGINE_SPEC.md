# Project Specification: Multi-Modal Semantic Discovery Engine

## 1. Project Overview
A high-performance "Vibe-Search" engine that uses Model Context Protocol (MCP), Multi-Modal RAG, and OpenAI to discover restaurants based on atmospheric intent rather than just keywords.

### Core Objectives
- **Semantic Discovery**: Convert unstructured reviews and images into a searchable "Vibe Graph."
- **MCP Integration**: Build a custom server to expose search tools to LLMs (Claude/GPT-4).
- **Multi-Modal Alignment**: Use CLIP to ensure visual vibes (photos) match textual descriptions.

## 2. Technical Stack
- **Languages**: TypeScript (MCP Server, Frontend), Python (Data Pipeline, ML).
- **Orchestration**: Model Context Protocol (MCP), OpenAI Agents SDK.
- **Vector Intelligence**: Pinecone (Serverless) for high-dimensional vector storage.
- **Machine Learning**: OpenAI text-embedding-3-small (Text), CLIP via PyTorch (Images).
- **Backend/API**: Node.js (Express) or Python (FastAPI).
- **Front-End**: React Native with Expo (Mobile focus).

## 3. Repository Structure
```
/
├── CLAUDE.md                # Claude's "Memory" (Rules, Tasks, Commands)
├── .cursorrules             # Rules for AI code generation
├── /mcp-server              # TypeScript MCP Server implementation
│   ├── src/index.ts         # Server entry & Tool registration
│   └── src/tools/           # Logic for search_vibe, analyze_visuals
├── /data-pipeline           # Python scripts for data ingestion
│   ├── scraper.py           # Distributed review/image scraper
│   ├── embedder.py          # OpenAI + CLIP embedding logic
│   └── upsert_pinecone.py   # Vector DB synchronization
├── /backend                 # Main Application API (Node.js)
└── /shared                  # Shared TypeScript types and schemas
```

## 4. MCP Server Definition (The Toolset)
The MCP server must expose the following Tools to the LLM Host:

### Tool: search_by_vibe
- **Description**: Performs a semantic vector search across restaurant "vibe" profiles.
- **Input**: query (string), location (optional string), limit (number).
- **Logic**: Calls Pinecone Index with query embedding.

### Tool: get_vibe_summary
- **Description**: Synthesizes raw review data into a natural language "Vibe Report."
- **Input**: restaurant_id (string).
- **Logic**: RAG pipeline fetching top 10 relevant review chunks.

## 5. Development Roadmap (Claude Task List)

### Phase 1: Infrastructure & Data (Python Focus)
- [ ] Initialize Python environment and install pinecone-client, openai, torch, clip.
- [ ] Build scraper.py to ingest 100 sample reviews/images for local testing.
- [ ] Create embedder.py to generate 1536-dim text vectors and 512-dim image vectors.
- [ ] Successfully upsert vectors to a Pinecone Serverless index.

┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1 PIPELINE                          │
└─────────────────────────────────────────────────────────────┘

1. SCRAPER
   scraper.py
   │
   ├─→ Generates sample data
   │   - 5 restaurants
   │   - 100 reviews  
   │   - 15 images
   │
   └─→ Saves JSON files
       data/sample/
         ├─ restaurants.json
         ├─ reviews.json
         └─ images.json

2. EMBEDDER
   embedder.py
   │
   ├─→ Reads reviews.json
   │   │
   │   └─→ For each review:
   │       - Calls OpenAI API
   │       - Text → 512-dim vector
   │       - Saves: review + embedding
   │
   └─→ Reads images.json
       │
       └─→ For each image:
           - Creates placeholder [0.0, ...]
           - Saves: image + zero vector
   │
   └─→ Saves JSON files
       data/embeddings/
         ├─ review_embeddings.json
         └─ image_embeddings.json

3. UPSERTER
   upsert_pinecone.py
   │
   ├─→ Connects to Pinecone
   │   - Checks/creates index
   │
   ├─→ Reads review_embeddings.json
   │   │
   │   └─→ For each review:
   │       - Creates vector object
   │       - Upserts to Pinecone (batches of 100)
   │
   └─→ Reads image_embeddings.json
       │
       └─→ Checks if zeros → Skips (Pinecone rejects)
   │
   └─→ Done! Vectors in Pinecone cloud

4. QUERY
   test_query.py / interactive_query.py
   │
   ├─→ User input: "dark moody bar"
   │
   ├─→ Convert to embedding:
   │   - Calls OpenAI API
   │   - Text → 512-dim vector
   │
   ├─→ Query Pinecone:
   │   - "Find similar vectors"
   │   - Cosine similarity search
   │
   └─→ Returns results:
       - Top 5 most similar reviews
       - With scores, text, metadata

### Phase 2: MCP Server Development (TypeScript Focus)
- [ ] Initialize MCP Server with @modelcontextprotocol/sdk.
- [ ] Implement StdioServerTransport for local communication.
- [ ] Register search_by_vibe tool with Zod schema validation.
- [ ] Connect MCP server to Pinecone retrieval logic.

### Phase 3: AI Orchestration (Agent Focus)
- [ ] Integrate OpenAI Agents SDK to connect the LLM to the MCP tools.
- [ ] Build a "Decision Layer" that decides when to use CLIP (images) vs. Text (reviews).
- [ ] Test the pipeline: Ask Claude "Find me a dark, moody bar in Berkeley."

## 6. Implementation Rules (For Claude Code)
- **Error Handling**: Always wrap tool calls in try-catch blocks with meaningful JSON-RPC error responses.
- **Type Safety**: Use strict TypeScript types and Zod for schema enforcement.
- **Performance**: Ensure vector retrieval latency stays under 100ms.
- **Logging**: Implement structured logging in the data pipeline for debugging scraper blocks.

## Getting Started Prompt for Claude Code:
"I want to build the Multi-Modal Vibe Engine specified in VIBE_ENGINE_SPEC.md. Start by initializing the /mcp-server directory using TypeScript and the official MCP SDK. Set up the basic server structure with a test 'ping' tool."
