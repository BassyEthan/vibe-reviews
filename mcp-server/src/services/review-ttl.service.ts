/**
 * Review TTL Service
 *
 * Manages review expiry and cleanup.
 * Reviews expire after 60 days but are kept in DB for 180 days total.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { REVIEW_CLEANUP_THRESHOLD_DAYS } from '../cache/cache-strategy.js';

export class ReviewTTLService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Mark expired reviews (past expires_at date).
   * Run this daily via cron job.
   */
  async markExpiredReviews(): Promise<number> {
    const result = await this.prisma.review.updateMany({
      where: {
        expires_at: { lte: new Date() },
        is_expired: false,
      },
      data: {
        is_expired: true,
      },
    });

    logger.info('Marked expired reviews', { count: result.count });
    return result.count;
  }

  /**
   * Purge old expired reviews (older than 180 days).
   * Run this weekly via cron job.
   */
  async purgeOldExpiredReviews(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - REVIEW_CLEANUP_THRESHOLD_DAYS
    );

    const result = await this.prisma.review.deleteMany({
      where: {
        is_expired: true,
        expires_at: { lte: cutoffDate },
      },
    });

    logger.info('Purged old expired reviews', {
      count: result.count,
      cutoffDate: cutoffDate.toISOString(),
    });
    return result.count;
  }

  /**
   * Check if place needs review refresh.
   * Returns true if place has no reviews or all reviews are expired.
   */
  async shouldRefreshReviews(placeId: string): Promise<boolean> {
    const validReviewsCount = await this.prisma.review.count({
      where: {
        place_id: placeId,
        is_expired: false,
      },
    });

    return validReviewsCount === 0;
  }

  /**
   * Get expiry statistics for monitoring.
   */
  async getExpiryStats(): Promise<{
    total: number;
    valid: number;
    expired: number;
    expiringSoon: number; // Expiring in next 7 days
  }> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const [total, expired, expiringSoon] = await Promise.all([
      this.prisma.review.count(),
      this.prisma.review.count({ where: { is_expired: true } }),
      this.prisma.review.count({
        where: {
          is_expired: false,
          expires_at: { lte: sevenDaysFromNow, gte: now },
        },
      }),
    ]);

    const valid = total - expired;

    return {
      total,
      valid,
      expired,
      expiringSoon,
    };
  }
}
