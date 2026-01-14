/**
 * Fetch Photos Processor
 *
 * Background job processor for fetching photos from photo providers.
 * Stores photos in database with deduplication.
 */

import { JobProcessor, Job } from '../interfaces/job-queue.interface.js';
import { IPhotoProvider } from '../../providers/interfaces/photo-provider.interface.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export class FetchPhotosProcessor implements JobProcessor {
  constructor(
    private photoProvider: IPhotoProvider,
    private prisma: PrismaClient
  ) {}

  async process(job: Job): Promise<void> {
    const { place } = job.data;

    if (!place) {
      throw new Error('Place data missing from job');
    }

    logger.info('Fetching photos', {
      jobId: job.id,
      placeId: place.id,
      placeName: place.name,
      provider: this.photoProvider.getProviderName(),
    });

    // Check if we already have photos (deduplication)
    const existingPhotos = await this.prisma.photo.count({
      where: { place_id: place.id },
    });

    if (existingPhotos > 0) {
      logger.info('Photos already exist, skipping', {
        jobId: job.id,
        placeId: place.id,
        count: existingPhotos,
      });
      return;
    }

    // Fetch photos from provider
    const photos = await this.photoProvider.getPhotos({
      placeId: place.id,
      externalPlaceId: place.fsq_place_id, // Map to provider's place ID
      maxPhotos: 5,
    });

    if (photos.length === 0) {
      logger.warn('No photos returned from provider', {
        jobId: job.id,
        placeId: place.id,
        provider: this.photoProvider.getProviderName(),
      });
      return;
    }

    // Store photos in database
    await this.prisma.photo.createMany({
      data: photos.map((photo) => ({
        place_id: place.id,
        provider: this.photoProvider.getProviderName().toLowerCase(),
        external_photo_id: photo.photoId,
        url: photo.url,
        width: photo.width,
        height: photo.height,
        attribution_text: photo.attributionText,
        attribution_url: photo.attributionUrl,
        html_attribution: photo.htmlAttribution,
      })),
      skipDuplicates: true, // Skip if photo already exists
    });

    logger.info('Photos stored', {
      jobId: job.id,
      placeId: place.id,
      count: photos.length,
      provider: this.photoProvider.getProviderName(),
    });
  }
}
