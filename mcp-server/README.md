# Vibe Search MCP Server

TypeScript MCP server for semantic restaurant discovery based on atmospheric intent.

## Features

- **search_by_vibe**: Semantic vector search across restaurant reviews
- **get_vibe_summary**: RAG-powered vibe report generation
- Production-ready error handling and logging
- Full TypeScript type safety with Zod validation
- Seamless integration with Claude Desktop

## Prerequisites

- Node.js >= 18.0.0
- OpenAI API key
- Pinecone API key
- Existing Pinecone index with restaurant review data (from data-pipeline)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required environment variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=512
OPENAI_CHAT_MODEL=gpt-4-turbo-preview

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=vibe-search

# Application Configuration
LOG_LEVEL=info
NODE_ENV=development
```

### 3. Build the server

```bash
npm run build
```

## Usage

### Running the Server

**Development mode (with watch):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run start
```

### Testing the Server

Run the demo script to test both tools:

```bash
npm run test
```

This will:
- Test semantic search with 3 sample queries
- Display results with scores and metadata
- Generate a vibe summary for the top result
- Validate end-to-end functionality

### Connecting to Claude Desktop

Add to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vibe-search": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-server/dist/index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "your_key_here",
        "PINECONE_API_KEY": "your_key_here"
      }
    }
  }
}
```

Then restart Claude Desktop. The tools will appear in Claude's available tools.

## Tools

### search_by_vibe

Performs semantic search across restaurant reviews based on vibe/atmosphere.

**Input:**
```typescript
{
  query: string;          // The vibe/atmosphere query
  location?: string;      // Optional location filter (not yet implemented)
  limit?: number;         // Max results (default: 5)
}
```

**Output:**
```typescript
{
  results: [
    {
      restaurant_id: string;
      text: string;
      score: number;
      rating?: number;
      author?: string;
      date?: string;
    }
  ];
  query: string;
  total_results: number;
}
```

**Example usage in Claude:**
```
Use search_by_vibe to find a dark moody bar for date night
```

### get_vibe_summary

Generates a natural language vibe report for a restaurant using RAG.

**Input:**
```typescript
{
  restaurant_id: string;  // The restaurant identifier
}
```

**Output:**
```typescript
{
  restaurant_id: string;
  summary: string;        // AI-generated vibe report
  review_count: number;
  sources: [
    {
      text: string;
      rating: number;
      author: string;
      date: string;
    }
  ];
}
```

**Example usage in Claude:**
```
Use get_vibe_summary for restaurant abc123
```

## Architecture

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server setup and tool registration
├── config/
│   └── env.ts            # Environment validation with Zod
├── services/
│   ├── openai.service.ts # OpenAI embeddings and completions
│   ├── pinecone.service.ts # Pinecone vector search
│   └── rag.service.ts    # RAG pipeline orchestration
├── tools/
│   ├── search-by-vibe.ts # Semantic search implementation
│   └── get-vibe-summary.ts # Vibe summary implementation
├── schemas/
│   └── tools.schema.ts   # Zod schemas for validation
└── utils/
    ├── logger.ts         # Winston structured logging
    └── error-handler.ts  # Error handling patterns
```

## Development

**Type checking:**
```bash
npm run type-check
```

**Linting:**
```bash
npm run lint
```

**Watch mode:**
```bash
npm run dev
```

## Production-Ready Patterns

### Error Handling
- Zod validation at tool boundaries
- Try-catch blocks in all async operations
- Structured error responses with context
- Comprehensive logging with stack traces

### Type Safety
- Strict TypeScript configuration (no `any` types)
- Zod runtime validation for external inputs
- Type inference from schemas
- Explicit return types on all functions

### Logging
- Winston structured logging
- Log levels: error, warn, info, debug
- File-based logs in `logs/` directory
- Performance metrics tracking

### Performance
- Single Pinecone connection pooling
- Efficient query patterns matching Python pipeline
- 512-dimensional embeddings for optimal performance

## Integration with Data Pipeline

This MCP server integrates seamlessly with the Python data pipeline:

- **Same embedding model**: OpenAI text-embedding-3-small (512 dims)
- **Same Pinecone index**: vibe-search
- **Same metadata structure**: {type, restaurant_id, text, rating, author, date}
- **Compatible query patterns**: Maintains consistency with existing data

## Troubleshooting

### Server won't start
- Check that Node.js >= 18 is installed: `node --version`
- Verify environment variables are set: `cat .env`
- Check logs in `logs/error.log`

### No results from search
- Ensure data-pipeline has uploaded data to Pinecone
- Verify Pinecone index name matches `.env` configuration
- Check that index contains vectors with `type: "review"` metadata

### OpenAI/Pinecone API errors
- Verify API keys are correct and have proper permissions
- Check API rate limits and quotas
- Review logs for detailed error messages

## License

MIT
