/**
 * Foursquare Search Provider
 *
 * Implements place discovery using Foursquare Places API.
 * ONLY calls /places/search - no photos, tips, or details endpoints.
 * Complies with ToS by keeping requests minimal and cacheable.
 */

import { BaseProvider } from '../interfaces/base-provider.interface.js';
import {
  ISearchProvider,
  PlaceSearchQuery,
  PlaceSearchResult,
} from '../interfaces/search-provider.interface.js';
import { logger } from '../../utils/logger.js';

export class FoursquareSearchProvider
  extends BaseProvider
  implements ISearchProvider
{
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: 'https://places-api.foursquare.com',
      rateLimitPerSecond: 10, // Conservative limit
      timeoutMs: 5000,
    });
  }

  async searchPlaces(query: PlaceSearchQuery): Promise<PlaceSearchResult[]> {
    await this.enforceRateLimit();

    const url = `${this.config.baseUrl}/places/search`;
    const params = new URLSearchParams({
      query: query.query,
      ll: `${query.latitude},${query.longitude}`,
      radius: query.radius.toString(),
      limit: query.limit.toString(),
      // Request only essential fields to minimize data transfer
      fields: 'fsq_id,name,geocodes,location,categories,distance',
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs
      );

      const response = await fetch(`${url}?${params}`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Foursquare API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as any;
      const results: PlaceSearchResult[] =
        data.results?.map((place: any) => ({
          fsq_place_id: place.fsq_id,
          name: place.name,
          latitude: place.geocodes?.main?.latitude || 0,
          longitude: place.geocodes?.main?.longitude || 0,
          address: place.location?.address || '',
          locality: place.location?.locality || '',
          region: place.location?.region || '',
          categories: place.categories?.map((cat: any) => cat.name) || [],
          distance: place.distance,
        })) || [];

      logger.info('Foursquare search completed', {
        provider: this.getProviderName(),
        query: query.query,
        results: results.length,
      });

      return results;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Foursquare search timeout', {
          provider: this.getProviderName(),
          query,
          timeout: this.config.timeoutMs,
        });
        throw new Error('Foursquare search timed out');
      }

      logger.error('Foursquare search failed', {
        provider: this.getProviderName(),
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      });
      throw error;
    }
  }

  getProviderName(): string {
    return 'Foursquare';
  }
}
