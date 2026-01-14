/**
 * Test script for provider implementations
 */

import { FoursquareSearchProvider } from '../src/providers/implementations/foursquare-search.provider.js';
import { GooglePhotoProvider } from '../src/providers/implementations/google-photo.provider.js';
import { TripadvisorReviewProvider } from '../src/providers/implementations/tripadvisor-review.provider.js';
import { env } from '../src/config/env.js';

async function testFoursquareProvider() {
  console.log('\n=== Testing Foursquare Search Provider ===\n');

  const provider = new FoursquareSearchProvider(env.FOURSQUARE_API_KEY);

  try {
    const results = await provider.searchPlaces({
      query: 'restaurant',
      latitude: 37.7749, // San Francisco
      longitude: -122.4194,
      radius: 5000,
      limit: 5,
    });

    console.log(`✅ Found ${results.length} places`);
    console.log('\nFirst result:');
    console.log(JSON.stringify(results[0], null, 2));
  } catch (error) {
    console.error('❌ Foursquare test failed:', error);
  }
}

async function testGooglePhotoProvider() {
  console.log('\n=== Testing Google Photo Provider (STUB) ===\n');

  const provider = new GooglePhotoProvider();

  try {
    const photos = await provider.getPhotos({
      placeId: 'test-place-id',
      externalPlaceId: 'google-place-id',
      maxPhotos: 3,
    });

    console.log(`✅ Got ${photos.length} mock photos`);
    console.log('\nFirst photo:');
    console.log(JSON.stringify(photos[0], null, 2));
  } catch (error) {
    console.error('❌ Google test failed:', error);
  }
}

async function testTripadvisorProvider() {
  console.log('\n=== Testing Tripadvisor Review Provider (STUB) ===\n');

  const provider = new TripadvisorReviewProvider();

  try {
    const reviews = await provider.getReviews({
      placeId: 'test-place-id',
      externalPlaceId: 'tripadvisor-location-id',
      maxReviews: 5,
      language: 'en',
    });

    console.log(`✅ Got ${reviews.length} mock reviews`);
    console.log('\nFirst review:');
    console.log(JSON.stringify(reviews[0], null, 2));
  } catch (error) {
    console.error('❌ Tripadvisor test failed:', error);
  }
}

async function runTests() {
  await testFoursquareProvider();
  await testGooglePhotoProvider();
  await testTripadvisorProvider();

  console.log('\n=== All tests completed ===\n');
}

runTests();
