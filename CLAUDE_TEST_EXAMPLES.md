# Claude Desktop Test Examples

Use these prompts in Claude Desktop to test the MCP server tools.

## Quick Start Test

**Basic test to verify connection:**
```
Can you use the search_by_vibe tool to find me a dark moody bar?
```

---

## Test 1: Basic Search by Vibe

**Test the `search_by_vibe` tool with different queries:**

### Example 1: Dark/Moody Atmosphere
```
Find me a dark, moody bar for a date night using the search_by_vibe tool
```

**What to expect:**
- Claude should call `search_by_vibe` with query "dark, moody bar for a date night"
- Results should include restaurant IDs, review text snippets, scores, and ratings
- Should match restaurants like "The Dark Corner" based on the sample data

### Example 2: Bright/Sunny Atmosphere
```
Use search_by_vibe to find a bright, sunny brunch spot
```

**What to expect:**
- Should match restaurants with bright, airy atmospheres
- Results might include "Sunny Bistro" or similar

### Example 3: Retro/Vintage Vibe
```
Search for a retro 1950s diner with neon signs
```

**What to expect:**
- Should match "Midnight Diner" or similar retro-themed restaurants

### Example 4: Romantic Atmosphere
```
Find restaurants with a romantic, intimate atmosphere
```

**What to expect:**
- Should match restaurants with romantic, elegant vibes
- Might include "Garden Terrace" based on sample data

### Example 5: Industrial/Modern
```
Search for an industrial, modern brewery
```

**What to expect:**
- Should match "Industrial Brew" or similar modern spaces

---

## Test 2: Get Vibe Summary (RAG)

**After getting search results, test `get_vibe_summary`:**

### Step 1: Get a Restaurant ID
First, run a search and ask Claude to extract a restaurant ID:
```
Find me a dark moody bar, and give me the restaurant ID of the first result
```

### Step 2: Get Summary
Then use that restaurant ID (replace `RESTAURANT_ID_HERE` with the actual ID):
```
Use get_vibe_summary to generate a vibe report for restaurant ID: RESTAURANT_ID_HERE
```

**What to expect:**
- Claude should call `get_vibe_summary` with the restaurant ID
- Should return a natural language summary based on aggregated reviews
- Should include review count and source citations

---

## Test 3: Combined Workflow

**Test both tools together:**
```
Find me a romantic restaurant, then generate a vibe summary for the top result
```

**What to expect:**
1. Claude calls `search_by_vibe` first
2. Extracts the restaurant_id from the top result
3. Calls `get_vibe_summary` with that restaurant_id
4. Returns both the search results and the summary

---

## Test 4: Custom Queries

**Try your own vibe queries:**
```
Find me a cozy hidden gem restaurant
```

```
Search for an elegant, sophisticated dining experience
```

```
Find a casual, laid-back place to unwind
```

**What to expect:**
- Semantic search should understand the vibe/atmosphere intent
- Results should match based on review content, not just keywords

---

## Test 5: Limit Parameter

**Test with custom result limits:**
```
Find me the top 3 dark moody bars using search_by_vibe
```

**What to expect:**
- Should return exactly 3 results (or fewer if less available)

---

## What Success Looks Like

✅ **Connection Working:**
- Claude responds without "Server disconnected" errors
- Claude mentions using the tools (e.g., "I'll use search_by_vibe to find...")
- Results appear in the response

✅ **Search Working:**
- Returns restaurant IDs and review snippets
- Scores indicate relevance (higher = more relevant)
- Results match the query's vibe/atmosphere

✅ **Summary Working:**
- Returns a natural language summary
- Includes review count
- Lists source reviews with ratings and dates

---

## Troubleshooting

**If you see "Server disconnected":**
- Check that Claude Desktop was restarted after updating the config
- Verify Node 18 is being used (check logs in `~/Library/Logs/Claude/mcp-server-vibe-search.log`)
- Ensure API keys are correctly set in the config

**If no results are returned:**
- Verify that data was uploaded to Pinecone (run the data pipeline first)
- Check that the Pinecone index name matches your config
- Ensure embeddings were generated correctly

**If tools aren't available:**
- Restart Claude Desktop completely
- Check that the MCP server appears in Claude Desktop's settings
- Verify the config file path is correct

---

## Expected Sample Data

Based on the sample data generator, you should have 5 restaurants:
- **The Dark Corner** (Berkeley, CA) - Dark moody bar
- **Sunny Bistro** (San Francisco, CA) - Bright sunny cafe
- **Midnight Diner** (Oakland, CA) - Retro 1950s diner
- **Garden Terrace** (Berkeley, CA) - Romantic elegant restaurant
- **Industrial Brew** (San Francisco, CA) - Modern industrial brewery

Each restaurant should have ~20 reviews in Pinecone.
