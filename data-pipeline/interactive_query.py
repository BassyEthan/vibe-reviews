"""
Interactive vibe search tester - type queries and see results.
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
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def query_vibe(query_text: str, top_k: int = 5):
    """Query Pinecone with a vibe search."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query_text,
        dimensions=512
    )
    query_embedding = response.data[0].embedding
    
    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )
    
    return results

if __name__ == "__main__":
    print("Vibe Search Tester - Type queries to test semantic search")
    print("Type 'quit' to exit\n")
    
    while True:
        query = input("Enter vibe query: ").strip()
        
        if query.lower() in ['quit', 'exit', 'q']:
            break
        
        if not query:
            continue
        
        print(f"\n{'='*60}")
        print(f"Query: '{query}'")
        print(f"{'='*60}\n")
        
        results = query_vibe(query, top_k=5)
        
        if not results.matches:
            print("No results found")
        else:
            for i, match in enumerate(results.matches, 1):
                print(f"{i}. Score: {match.score:.4f}")
                print(f"   {match.metadata.get('text', 'N/A')}")
                print()
        
        print()
