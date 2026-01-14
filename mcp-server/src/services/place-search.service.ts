/**
 * Place Search Service
 *
 * Orchestrates place discovery and enrichment.
 * Separates request path (fast) from enrichment path (background).
 */

import { PrismaClient } from '@prisma/client';
import { ISearchProvider } from '../providers/interfaces/search-provider.interface.js';
import { IJobQueue, JobType } from '../jobs/interfaces/job-queue.interface.js';
import { JOB_PRIORITIES } from '../cache/cache-strategy.js';
import { logger } from '../utils/logger.js';

export interface DiscoveryResult {
  placeIds: string[];
  totalDiscovered: number;
  newPlaces: number;
  existingPlaces: number;
}

export class PlaceSearchService {
  constructor(
    private prisma: PrismaClient,
    private searchProvider: ISearchProvider,
    private jobQueue: IJobQueue
  ) {}

  /**
   * Discover new places by location (Foursquare search).
   * Stores places in DB and triggers background enrichment.
   * Returns place IDs immediately (never blocks on enrichment).
   */
  async discoverPlaces(
    location: { lat: number; lng: number },
    radius: number = 5000,
    query: string = 'restaurant'
  ): Promise<DiscoveryResult> {
    logger.info('Discovering places', {
      location,
      radius,
      query,
      provider: this.searchProvider.getProviderName(),
    });

    // Step 1: Search Foursquare
    const foursquareResults = await this.searchProvider.searchPlaces({
      query,
      latitude: location.lat,
      longitude: location.lng,
      radius,
      limit: 50,
    });

    logger.info('Foursquare search completed', {
      resultsCount: foursquareResults.length,
    });

    // Step 2: Upsert places to database (deduplication by fsq_place_id)
    const placeIds: string[] = [];
    let newPlaces = 0;
    let existingPlaces = 0;

    for (const result of foursquareResults) {
      const existingPlace = await this.prisma.place.findUnique({
        where: { fsq_place_id: result.fsq_place_id },
      });

      if (existingPlace) {
        placeIds.push(existingPlace.id);
        existingPlaces++;
        logger.debug('Place already exists', {
          placeId: existingPlace.id,
          fsqPlaceId: result.fsq_place_id,
        });
        continue;
      }

      // Create new place
      const newPlace = await this.prisma.place.create({
        data: {
          fsq_place_id: result.fsq_place_id,
          name: result.name,
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.address,
          locality: result.locality,
          region: result.region,
          categories: result.categories,
        },
      });

      placeIds.push(newPlace.id);
      newPlaces++;

      logger.info('New place created', {
        placeId: newPlace.id,
        fsqPlaceId: result.fsq_place_id,
        name: newPlace.name,
      });

      // Queue enrichment jobs (photos + reviews)
      await this.jobQueue.add(
        JobType.FETCH_PHOTOS,
        { placeId: newPlace.id },
        { priority: JOB_PRIORITIES.NORMAL }
      );

      await this.jobQueue.add(
        JobType.FETCH_REVIEWS,
        { placeId: newPlace.id },
        { priority: JOB_PRIORITIES.NORMAL }
      );

      logger.info('Enrichment jobs queued', {
        placeId: newPlace.id,
        jobs: ['FETCH_PHOTOS', 'FETCH_REVIEWS'],
      });
    }

    const result: DiscoveryResult = {
      placeIds,
      totalDiscovered: foursquareResults.length,
      newPlaces,
      existingPlaces,
    };

    logger.info('Place discovery completed', result);

    return result;
  }

  /**
   * Trigger enrichment for an existing place.
   * Useful when place exists but is missing photos/reviews.
   */
  async triggerEnrichment(
    placeId: string,
    options: {
      photos?: boolean;
      reviews?: boolean;
      priority?: number;
    } = {}
  ): Promise<void> {
    const { photos = true, reviews = true, priority = JOB_PRIORITIES.NORMAL } =
      options;

    logger.info('Triggering enrichment', {
      placeId,
      photos,
      reviews,
      priority,
    });

    if (photos) {
      await this.jobQueue.add(
        JobType.FETCH_PHOTOS,
        { placeId },
        { priority }
      );
    }

    if (reviews) {
      await this.jobQueue.add(
        JobType.FETCH_REVIEWS,
        { placeId },
        { priority }
      );
    }
  }

  /**
   * Check which places need enrichment and queue jobs.
   * Useful for batch enrichment of existing places.
   */
  async enrichMissingData(placeIds: string[]): Promise<{
    photosQueued: number;
    reviewsQueued: number;
  }> {
    let photosQueued = 0;
    let reviewsQueued = 0;

    for (const placeId of placeIds) {
      // Check what's missing
      const [photoCount, reviewCount] = await Promise.all([
        this.prisma.photo.count({ where: { place_id: placeId } }),
        this.prisma.review.count({
          where: { place_id: placeId, is_expired: false },
        }),
      ]);

      // Queue jobs for missing data
      if (photoCount === 0) {
        await this.jobQueue.add(
          JobType.FETCH_PHOTOS,
          { placeId },
          { priority: JOB_PRIORITIES.LOW }
        );
        photosQueued++;
      }

      if (reviewCount === 0) {
        await this.jobQueue.add(
          JobType.FETCH_REVIEWS,
          { placeId },
          { priority: JOB_PRIORITIES.LOW }
        );
        reviewsQueued++;
      }
    }

    logger.info('Batch enrichment queued', {
      placeCount: placeIds.length,
      photosQueued,
      reviewsQueued,
    });

    return { photosQueued, reviewsQueued };
  }
}
