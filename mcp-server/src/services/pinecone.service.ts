import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface SearchOptions {
  topK: number;
  filter?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: {
    type: string;
    restaurant_id: string;
    text: string;
    rating?: number;
    author?: string;
    date?: string;
  };
}

export class PineconeService {
  private client: Pinecone;
  private indexName: string;

  constructor() {
    this.client = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    this.indexName = env.PINECONE_INDEX_NAME;
    logger.info('Pinecone service initialized', { indexName: this.indexName });
  }

  async queryByVector(
    embedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    try {
      const index = this.client.index(this.indexName);

      const queryRequest: any = {
        vector: embedding,
        topK: options.topK,
        includeMetadata: true,
      };

      if (options.filter) {
        queryRequest.filter = options.filter;
      }

      const response = await index.query(queryRequest);

      const results: SearchResult[] = response.matches.map((match: any) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as SearchResult['metadata'],
      }));

      logger.info('Query executed successfully', {
        resultsCount: results.length,
        topK: options.topK,
        hasFilter: !!options.filter,
      });

      return results;
    } catch (error) {
      logger.error('Pinecone query failed', { error, options });
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async queryByRestaurantId(
    restaurantId: string,
    topK: number = 10
  ): Promise<SearchResult[]> {
    try {
      const index = this.client.index(this.indexName);

      // Use a broad query to get all reviews, then filter by restaurant_id
      // This works better than using a zero vector with filters
      const dummyVector = new Array(env.OPENAI_EMBEDDING_DIMENSIONS).fill(0.1);

      const response = await index.query({
        vector: dummyVector,
        topK: topK * 10, // Get more results to ensure we have enough after filtering
        includeMetadata: true,
        filter: {
          type: { $eq: 'review' },
          restaurant_id: { $eq: restaurantId },
        },
      });

      // Filter results that match the restaurant_id
      const filteredResults: SearchResult[] = response.matches
        .filter((match: any) => match.metadata?.restaurant_id === restaurantId)
        .slice(0, topK)
        .map((match: any) => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as SearchResult['metadata'],
        }));

      logger.info('Fetched reviews by restaurant ID', {
        restaurantId,
        resultsCount: filteredResults.length,
        totalMatches: response.matches.length,
      });

      return filteredResults;
    } catch (error) {
      logger.error('Failed to fetch reviews by restaurant ID', { error, restaurantId });
      throw new Error(`Restaurant query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
