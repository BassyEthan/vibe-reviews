/**
 * Search Provider Interface
 *
 * Interface for place discovery providers (e.g., Foursquare).
 * ONLY returns basic place metadata - no photos, no reviews, no tips.
 */

export interface PlaceSearchQuery {
  query: string; // "restaurant", "bar", etc.
  latitude: number;
  longitude: number;
  radius: number; // meters
  limit: number;
}

export interface PlaceSearchResult {
  fsq_place_id: string; // Foursquare unique ID (external)
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  locality: string; // "San Francisco"
  region: string; // "CA"
  categories: string[]; // ["Restaurant", "Italian"]
  distance?: number; // meters from query point
}

export interface ISearchProvider {
  /**
   * Search for places by query and location.
   * ONLY returns basic place info - no photos, no reviews, no tips.
   * Use this for initial discovery.
   */
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceSearchResult[]>;

  /**
   * Get provider name for logging/debugging.
   */
  getProviderName(): string;
}
