/**
 * Fetch Reviews Processor
 *
 * Background job processor for fetching reviews from review providers.
 * Stores reviews in database with TTL (60 day default expiry).
 */

import { JobProcessor, Job } from '../interfaces/job-queue.interface.js';
import { IReviewProvider } from '../../providers/interfaces/review-provider.interface.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

const REVIEW_TTL_DAYS = 60; // Reviews expire after 60 days

export class FetchReviewsProcessor implements JobProcessor {
  constructor(
    private reviewProvider: IReviewProvider,
    private prisma: PrismaClient
  ) {}

  async process(job: Job): Promise<void> {
    const { place } = job.data;

    if (!place) {
      throw new Error('Place data missing from job');
    }

    logger.info('Fetching reviews', {
      jobId: job.id,
      placeId: place.id,
      placeName: place.name,
      provider: this.reviewProvider.getProviderName(),
    });

    // Check if we already have valid (non-expired) reviews
    const existingValidReviews = await this.prisma.review.count({
      where: {
        place_id: place.id,
        is_expired: false,
      },
    });

    if (existingValidReviews > 0) {
      logger.info('Valid reviews already exist, skipping', {
        jobId: job.id,
        placeId: place.id,
        count: existingValidReviews,
      });
      return;
    }

    // Fetch reviews from provider
    const reviews = await this.reviewProvider.getReviews({
      placeId: place.id,
      externalPlaceId: place.fsq_place_id, // Map to provider's place ID
      maxReviews: 10,
      language: 'en',
    });

    if (reviews.length === 0) {
      logger.warn('No reviews returned from provider', {
        jobId: job.id,
        placeId: place.id,
        provider: this.reviewProvider.getProviderName(),
      });
      return;
    }

    // Calculate expiry date (60 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REVIEW_TTL_DAYS);

    // Store reviews in database
    await this.prisma.review.createMany({
      data: reviews.map((review) => ({
        place_id: place.id,
        provider: this.reviewProvider.getProviderName().toLowerCase(),
        external_review_id: review.reviewId,
        text: review.text,
        rating: review.rating,
        author: review.author,
        published_date: new Date(review.publishedDate),
        language: review.language,
        helpful_votes: review.helpfulVotes || 0,
        expires_at: expiresAt,
        is_expired: false,
      })),
      skipDuplicates: true, // Skip if review already exists
    });

    logger.info('Reviews stored', {
      jobId: job.id,
      placeId: place.id,
      count: reviews.length,
      provider: this.reviewProvider.getProviderName(),
      expiresAt: expiresAt.toISOString(),
    });
  }
}
