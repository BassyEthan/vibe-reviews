import { RAGService } from '../services/rag.service.js';
import { GetVibeSummaryInput, GetVibeSummaryOutput } from '../schemas/tools.schema.js';
import { logger } from '../utils/logger.js';

export async function getVibeSummary(
  input: GetVibeSummaryInput,
  ragService: RAGService
): Promise<GetVibeSummaryOutput> {
  try {
    logger.info('Executing get_vibe_summary', { restaurant_id: input.restaurant_id });

    // Generate RAG-based summary
    const summary = await ragService.generateVibeSummary(input.restaurant_id);

    logger.info('get_vibe_summary completed', {
      restaurant_id: input.restaurant_id,
      reviewCount: summary.review_count,
    });

    return summary;
  } catch (error) {
    logger.error('get_vibe_summary failed', { error, input });
    throw error;
  }
}
