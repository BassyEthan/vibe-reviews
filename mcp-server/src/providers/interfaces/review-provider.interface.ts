/**
 * Review Provider Interface
 *
 * Interface for review providers (e.g., Tripadvisor).
 * Used for background enrichment only - never called in request path.
 */

export interface ReviewRequest {
  placeId: string; // Our internal UUID
  externalPlaceId: string; // Tripadvisor location ID
  maxReviews: number;
  language?: string; // "en", "es", etc.
}

export interface ReviewResult {
  reviewId: string; // Provider's review ID
  text: string;
  rating: number; // 1-5 scale
  author: string;
  publishedDate: string; // ISO 8601
  language: string;
  helpfulVotes?: number;
}

export interface IReviewProvider {
  /**
   * Fetch reviews for a place.
   * Reviews have TTL of 30-90 days (configurable).
   * This will be called by background job processor only.
   */
  getReviews(request: ReviewRequest): Promise<ReviewResult[]>;

  /**
   * Get provider name for logging/debugging.
   */
  getProviderName(): string;
}
