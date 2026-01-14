import { OpenAIService } from './openai.service.js';
import { PineconeService } from './pinecone.service.js';
import { logger } from '../utils/logger.js';

export interface VibeSummary {
  restaurant_id: string;
  summary: string;
  review_count: number;
  sources: Array<{
    text: string;
    rating: number;
    author: string;
    date: string;
  }>;
}

export class RAGService {
  constructor(
    private openaiService: OpenAIService,
    private pineconeService: PineconeService
  ) {
    logger.info('RAG service initialized');
  }

  async generateVibeSummary(restaurantId: string): Promise<VibeSummary> {
    try {
      // Step 1: Retrieve relevant reviews for this restaurant
      const reviews = await this.pineconeService.queryByRestaurantId(restaurantId, 10);

      if (reviews.length === 0) {
        throw new Error(`No reviews found for restaurant ID: ${restaurantId}`);
      }

      // Step 2: Prepare context from reviews
      const context = reviews.map(review => {
        const meta = review.metadata;
        return `Review (Rating: ${meta.rating}/5 by ${meta.author} on ${meta.date}):\n${meta.text}`;
      });

      // Step 3: Generate summary using LLM with RAG context
      const systemPrompt = `You are a restaurant vibe analyst. Your task is to synthesize multiple customer reviews into a cohesive "Vibe Report" that captures the overall atmosphere, ambiance, and experience of the restaurant. Focus on:

1. Atmosphere & Ambiance: Lighting, decor, music, overall feel
2. Mood & Energy: Romantic, casual, lively, intimate, etc.
3. Ideal Occasions: Date nights, brunch, celebrations, casual dining
4. Unique Characteristics: What makes this place special

Be concise, evocative, and use sensory language. Aim for 3-4 sentences that paint a clear picture.`;

      const userMessage = `Based on the reviews provided in the context, generate a compelling Vibe Report for this restaurant.`;

      const summary = await this.openaiService.generateCompletion(
        systemPrompt,
        userMessage,
        context
      );

      // Step 4: Format response
      const vibeSummary: VibeSummary = {
        restaurant_id: restaurantId,
        summary,
        review_count: reviews.length,
        sources: reviews.map(r => ({
          text: r.metadata.text,
          rating: r.metadata.rating || 0,
          author: r.metadata.author || 'Anonymous',
          date: r.metadata.date || 'Unknown',
        })),
      };

      logger.info('Generated vibe summary', {
        restaurantId,
        reviewCount: reviews.length,
        summaryLength: summary.length,
      });

      return vibeSummary;
    } catch (error) {
      logger.error('Failed to generate vibe summary', { error, restaurantId });
      throw new Error(`Vibe summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
