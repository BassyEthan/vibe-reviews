# Data Pipeline

Python scripts for data ingestion, embedding generation, and vector database synchronization.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run the pipeline:**
   ```bash
   # Step 1: Generate sample data
   python scraper.py
   
   # Step 2: Generate embeddings
   python embedder.py
   
   # Step 3: Upsert to Pinecone
   python upsert_pinecone.py
   ```

## Files

- `scraper.py`: Generates sample restaurant/review/image data for testing
- `embedder.py`: Generates text embeddings (OpenAI) and image embeddings (CLIP)
- `upsert_pinecone.py`: Synchronizes vectors to Pinecone Serverless index

## Data Flow

1. **Scraper** → Generates sample data → `data/sample/`
2. **Embedder** → Processes data → Generates embeddings → `data/embeddings/`
3. **Upserter** → Loads embeddings → Upserts to Pinecone
