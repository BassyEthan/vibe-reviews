/**
 * Google Photo Provider (STUB)
 *
 * Returns mock photo data for Phase 2.
 * Real Google Places API integration will be added in later phase.
 */

import { BaseProvider } from '../interfaces/base-provider.interface.js';
import {
  IPhotoProvider,
  PhotoRequest,
  PhotoResult,
} from '../interfaces/photo-provider.interface.js';
import { logger } from '../../utils/logger.js';

export class GooglePhotoProvider
  extends BaseProvider
  implements IPhotoProvider
{
  constructor(apiKey: string = 'stub_key') {
    super({
      apiKey,
      baseUrl: 'https://places.googleapis.com/v1',
      rateLimitPerSecond: 5,
      timeoutMs: 5000,
    });
  }

  async getPhotos(request: PhotoRequest): Promise<PhotoResult[]> {
    await this.enforceRateLimit();

    logger.info('Fetching photos (STUB)', {
      provider: this.getProviderName(),
      placeId: request.placeId,
      maxPhotos: request.maxPhotos,
    });

    // Return mock photos
    const mockPhotos: PhotoResult[] = [
      {
        photoId: `mock-photo-1-${request.placeId}`,
        url: 'https://via.placeholder.com/800x600?text=Restaurant+Interior',
        width: 800,
        height: 600,
        attributionText: 'Photo by Mock User 1',
        attributionUrl: 'https://example.com/mock-user-1',
        htmlAttribution: '<a href="https://example.com/mock-user-1">Mock User 1</a>',
      },
      {
        photoId: `mock-photo-2-${request.placeId}`,
        url: 'https://via.placeholder.com/800x600?text=Restaurant+Food',
        width: 800,
        height: 600,
        attributionText: 'Photo by Mock User 2',
        attributionUrl: 'https://example.com/mock-user-2',
        htmlAttribution: '<a href="https://example.com/mock-user-2">Mock User 2</a>',
      },
      {
        photoId: `mock-photo-3-${request.placeId}`,
        url: 'https://via.placeholder.com/800x600?text=Restaurant+Exterior',
        width: 800,
        height: 600,
        attributionText: 'Photo by Mock User 3',
        attributionUrl: 'https://example.com/mock-user-3',
        htmlAttribution: '<a href="https://example.com/mock-user-3">Mock User 3</a>',
      },
    ];

    return mockPhotos.slice(0, request.maxPhotos);
  }

  getProviderName(): string {
    return 'Google';
  }
}
