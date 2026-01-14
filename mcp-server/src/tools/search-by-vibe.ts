import { OpenAIService } from '../services/openai.service.js';
import { PineconeService } from '../services/pinecone.service.js';
import { SearchByVibeInput, SearchByVibeOutput } from '../schemas/tools.schema.js';
import { logger } from '../utils/logger.js';

export async function searchByVibe(
  input: SearchByVibeInput,
  openaiService: OpenAIService,
  pineconeService: PineconeService
): Promise<SearchByVibeOutput> {
  try {
    logger.info('Executing search_by_vibe', { query: input.query, limit: input.limit });

    // Step 1: Generate embedding for the query
    const queryEmbedding = await openaiService.generateEmbedding(input.query);

    // Step 2: Build filter options
    const filter: Record<string, any> = {
      type: { $eq: 'review' },
    };

    // Note: location filtering would require location data in metadata
    // For now, we just filter by type=review
    if (input.location) {
      logger.info('Location filter requested but not implemented in current metadata schema', {
        location: input.location
      });
    }

    const searchOptions = {
      topK: input.limit,
      filter,
    };

    // Step 3: Query Pinecone
    const searchResults = await pineconeService.queryByVector(queryEmbedding, searchOptions);

    // Step 4: Format output
    const output: SearchByVibeOutput = {
      results: searchResults.map(result => ({
        restaurant_id: result.metadata.restaurant_id,
        text: result.metadata.text,
        score: result.score,
        rating: result.metadata.rating,
        author: result.metadata.author,
        date: result.metadata.date,
      })),
      query: input.query,
      total_results: searchResults.length,
    };

    logger.info('search_by_vibe completed', {
      query: input.query,
      resultsCount: output.total_results,
    });

    return output;
  } catch (error) {
    logger.error('search_by_vibe failed', { error, input });
    throw error;
  }
}
