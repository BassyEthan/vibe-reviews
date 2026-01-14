"""
Simple test script to query Pinecone and verify search is working.
"""

import os
from pinecone import Pinecone
from dotenv import load_dotenv
import openai

load_dotenv()

# Initialize
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = os.getenv("PINECONE_INDEX_NAME", "vibe-search")
index = pc.Index(index_name)

# Initialize OpenAI for query embedding
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def query_vibe(query_text: str, top_k: int = 5):
    """Query Pinecone with a vibe search."""
    # Generate embedding for query
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query_text,
        dimensions=512
    )
    query_embedding = response.data[0].embedding
    
    # Query Pinecone
    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )
    
    return results

if __name__ == "__main__":
    # Test different queries - try these to see semantic search in action
    test_queries = [
        "dark moody bar for date night",
        "bright sunny brunch spot",
        "retro 1950s diner with neon signs",
        "romantic intimate atmosphere",
        "industrial modern brewery",
        "cozy hidden gem",
        "elegant sophisticated dining",
        "casual laid back place to unwind"
    ]
    
    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Query: '{query}'")
        print(f"{'='*60}")
        
        results = query_vibe(query, top_k=5)
        
        for i, match in enumerate(results.matches, 1):
            print(f"\n{i}. Score: {match.score:.4f}")
            print(f"   ID: {match.id}")
            print(f"   Text: {match.metadata.get('text', 'N/A')[:80]}...")
            print(f"   Restaurant ID: {match.metadata.get('restaurant_id', 'N/A')}")
            print(f"   Rating: {match.metadata.get('rating', 'N/A')}")
