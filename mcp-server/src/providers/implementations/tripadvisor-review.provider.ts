/**
 * Tripadvisor Review Provider
 *
 * Integrates with Tripadvisor Content API v2.0 to fetch restaurant reviews.
 * ONLY called from background jobs - never blocks user requests.
 */

import { BaseProvider } from '../interfaces/base-provider.interface.js';
import {
  IReviewProvider,
  ReviewRequest,
  ReviewResult,
} from '../interfaces/review-provider.interface.js';
import { logger } from '../../utils/logger.js';

interface TripadvisorReview {
  id: string;
  lang: string;
  published_date: string;
  rating: number;
  helpful_votes?: number;
  title?: string;
  text: string;
  user?: {
    username?: string;
  };
}

interface TripadvisorResponse {
  data?: TripadvisorReview[];
  error?: {
    message: string;
  };
}

export class TripadvisorReviewProvider
  extends BaseProvider
  implements IReviewProvider
{
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: 'https://api.content.tripadvisor.com/api/v1',
      rateLimitPerSecond: 5, // Conservative rate limit
      timeoutMs: 10000, // 10 second timeout
    });
  }

  async getReviews(request: ReviewRequest): Promise<ReviewResult[]> {
    await this.enforceRateLimit();

    logger.info('Fetching reviews from Tripadvisor', {
      provider: this.getProviderName(),
      placeId: request.placeId,
      externalPlaceId: request.externalPlaceId,
      maxReviews: request.maxReviews,
      language: request.language,
    });

    // If no external ID provided, we can't fetch reviews
    if (!request.externalPlaceId) {
      logger.warn('No Tripadvisor location ID provided, cannot fetch reviews', {
        placeId: request.placeId,
      });
      return [];
    }

    try {
      const url = `${this.config.baseUrl}/location/${request.externalPlaceId}/reviews`;
      const params = new URLSearchParams({
        key: this.config.apiKey,
        language: request.language || 'en',
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs
      );

      const response = await fetch(`${url}?${params}`, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 404) {
          logger.warn('Tripadvisor location not found', {
            externalPlaceId: request.externalPlaceId,
            status: 404,
          });
          return [];
        }

        if (response.status === 429) {
          logger.error('Tripadvisor rate limit exceeded', {
            status: 429,
            externalPlaceId: request.externalPlaceId,
          });
          throw new Error('Tripadvisor rate limit exceeded');
        }

        logger.error('Tripadvisor API error', {
          status: response.status,
          statusText: response.statusText,
          externalPlaceId: request.externalPlaceId,
        });
        throw new Error(
          `Tripadvisor API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as TripadvisorResponse;

      // Check for API-level errors
      if (data.error) {
        logger.error('Tripadvisor API returned error', {
          error: data.error.message,
          externalPlaceId: request.externalPlaceId,
        });
        return [];
      }

      // Check if reviews exist
      if (!data.data || data.data.length === 0) {
        logger.warn('No reviews found for location', {
          externalPlaceId: request.externalPlaceId,
        });
        return [];
      }

      // Normalize reviews to our format
      const reviews: ReviewResult[] = data.data
        .slice(0, request.maxReviews)
        .map((review) => this.normalizeReview(review));

      logger.info('Tripadvisor reviews fetched successfully', {
        provider: this.getProviderName(),
        placeId: request.placeId,
        externalPlaceId: request.externalPlaceId,
        count: reviews.length,
      });

      return reviews;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Tripadvisor request timeout', {
          externalPlaceId: request.externalPlaceId,
          timeout: this.config.timeoutMs,
        });
        // Return empty array on timeout instead of throwing
        return [];
      }

      // Log the error but don't throw - return empty array
      logger.error('Failed to fetch Tripadvisor reviews', {
        error: error instanceof Error ? error.message : 'Unknown error',
        externalPlaceId: request.externalPlaceId,
        placeId: request.placeId,
      });

      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Normalize Tripadvisor review to our standard format.
   */
  private normalizeReview(review: TripadvisorReview): ReviewResult {
    // Combine title and text for fuller context
    const fullText = review.title
      ? `${review.title}. ${review.text}`
      : review.text;

    return {
      reviewId: review.id,
      text: fullText,
      rating: review.rating,
      author: review.user?.username || 'Anonymous',
      publishedDate: review.published_date,
      language: review.lang,
      helpfulVotes: review.helpful_votes || 0,
    };
  }

  getProviderName(): string {
    return 'Tripadvisor';
  }
}
