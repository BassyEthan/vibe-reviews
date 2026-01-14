/**
 * Photo Provider Interface
 *
 * Interface for photo providers (e.g., Google Places).
 * Used for background enrichment only - never called in request path.
 */

export interface PhotoRequest {
  placeId: string; // Our internal UUID
  externalPlaceId: string; // Google Place ID
  maxPhotos: number;
}

export interface PhotoResult {
  photoId: string; // Provider's photo ID
  url: string; // Full resolution URL
  width: number;
  height: number;
  attributionText: string; // "Photo by John Doe" (required by Google)
  attributionUrl?: string;
  htmlAttribution?: string; // Full HTML attribution (Google requires this)
}

export interface IPhotoProvider {
  /**
   * Fetch photos for a place.
   * Must include attribution metadata (required by Google ToS).
   * This will be called by background job processor only.
   */
  getPhotos(request: PhotoRequest): Promise<PhotoResult[]>;

  /**
   * Get provider name for logging/debugging.
   */
  getProviderName(): string;
}
