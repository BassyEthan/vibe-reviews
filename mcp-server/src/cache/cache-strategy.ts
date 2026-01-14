/**
 * Caching Strategy Documentation
 *
 * Defines TTL values and priorities for different data types.
 * See foundation architecture plan for complete caching rationale.
 */

/**
 * Cache TTL values in seconds
 */
export const CACHE_TTL = {
  PLACES: Infinity, // Never expire - place data is stable
  PHOTOS: Infinity, // Never expire - photos don't change
  REVIEWS: 60 * 24 * 60 * 60, // 60 days - reviews need refreshing
  EMBEDDINGS: Infinity, // Never expire - embeddings are expensive
} as const;

/**
 * Job priorities (higher = more urgent)
 */
export const JOB_PRIORITIES = {
  HIGH: 10, // User-triggered (immediate need)
  NORMAL: 5, // Background enrichment
  LOW: 1, // Maintenance tasks
} as const;

/**
 * Review TTL in days
 */
export const REVIEW_TTL_DAYS = 60;

/**
 * Old review cleanup threshold (days after expiry before deletion)
 */
export const REVIEW_CLEANUP_THRESHOLD_DAYS = 180;
