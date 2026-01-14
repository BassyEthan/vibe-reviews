/**
 * Place Details Service
 *
 * Reads place details from PostgreSQL cache.
 * NEVER waits on external APIs - returns cached data only.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export interface PlaceDetails {
  id: string;
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  region: string;
  categories: string[];
  photos: PlacePhoto[];
  reviews: PlaceReview[];
  enrichmentStatus: {
    hasPhotos: boolean;
    hasReviews: boolean;
    isFullyEnriched: boolean;
  };
}

export interface PlacePhoto {
  id: string;
  url: string;
  width: number;
  height: number;
  provider: string;
  attributionText: string;
  attributionUrl?: string;
  htmlAttribution?: string;
}

export interface PlaceReview {
  id: string;
  text: string;
  rating: number;
  author: string;
  publishedDate: Date;
  provider: string;
  language: string;
  helpfulVotes: number;
  isExpired: boolean;
}

export class PlaceDetailsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get place details by internal UUID.
   * Returns cached data only - never triggers API calls.
   */
  async getPlaceById(placeId: string): Promise<PlaceDetails | null> {
    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
      include: {
        photos: true,
        reviews: {
          where: { is_expired: false }, // Only return valid reviews
          orderBy: { rating: 'desc' }, // Highest rated first
        },
      },
    });

    if (!place) {
      logger.warn('Place not found', { placeId });
      return null;
    }

    logger.info('Retrieved place details', {
      placeId,
      placeName: place.name,
      photoCount: place.photos.length,
      reviewCount: place.reviews.length,
    });

    return this.mapPlaceDetails(place);
  }

  /**
   * Get place details by Foursquare place ID.
   */
  async getPlaceByFsqId(fsqPlaceId: string): Promise<PlaceDetails | null> {
    const place = await this.prisma.place.findUnique({
      where: { fsq_place_id: fsqPlaceId },
      include: {
        photos: true,
        reviews: {
          where: { is_expired: false },
          orderBy: { rating: 'desc' },
        },
      },
    });

    if (!place) {
      logger.warn('Place not found by Foursquare ID', { fsqPlaceId });
      return null;
    }

    return this.mapPlaceDetails(place);
  }

  /**
   * Get multiple places by IDs (batch operation).
   */
  async getPlacesByIds(placeIds: string[]): Promise<PlaceDetails[]> {
    const places = await this.prisma.place.findMany({
      where: { id: { in: placeIds } },
      include: {
        photos: true,
        reviews: {
          where: { is_expired: false },
          orderBy: { rating: 'desc' },
        },
      },
    });

    logger.info('Retrieved multiple places', {
      requestedCount: placeIds.length,
      foundCount: places.length,
    });

    return places.map((place) => this.mapPlaceDetails(place));
  }

  /**
   * Check enrichment status for a place.
   */
  async getEnrichmentStatus(placeId: string): Promise<{
    hasPhotos: boolean;
    hasReviews: boolean;
    isFullyEnriched: boolean;
  }> {
    const [photoCount, reviewCount] = await Promise.all([
      this.prisma.photo.count({ where: { place_id: placeId } }),
      this.prisma.review.count({
        where: { place_id: placeId, is_expired: false },
      }),
    ]);

    const hasPhotos = photoCount > 0;
    const hasReviews = reviewCount > 0;
    const isFullyEnriched = hasPhotos && hasReviews;

    return {
      hasPhotos,
      hasReviews,
      isFullyEnriched,
    };
  }

  /**
   * Map Prisma place model to PlaceDetails interface.
   */
  private mapPlaceDetails(place: any): PlaceDetails {
    return {
      id: place.id,
      fsq_place_id: place.fsq_place_id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      locality: place.locality,
      region: place.region,
      categories: place.categories,
      photos: place.photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        width: photo.width,
        height: photo.height,
        provider: photo.provider,
        attributionText: photo.attribution_text,
        attributionUrl: photo.attribution_url,
        htmlAttribution: photo.html_attribution,
      })),
      reviews: place.reviews.map((review: any) => ({
        id: review.id,
        text: review.text,
        rating: review.rating,
        author: review.author,
        publishedDate: review.published_date,
        provider: review.provider,
        language: review.language,
        helpfulVotes: review.helpful_votes,
        isExpired: review.is_expired,
      })),
      enrichmentStatus: {
        hasPhotos: place.photos.length > 0,
        hasReviews: place.reviews.length > 0,
        isFullyEnriched:
          place.photos.length > 0 && place.reviews.length > 0,
      },
    };
  }
}
