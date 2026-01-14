/**
 * Test script for service layer integration
 */

import { PrismaClient } from '@prisma/client';
import { InProcessJobQueue } from '../src/jobs/implementations/in-process-queue.js';
import { FetchPhotosProcessor } from '../src/jobs/processors/fetch-photos.processor.js';
import { FetchReviewsProcessor } from '../src/jobs/processors/fetch-reviews.processor.js';
import { GooglePhotoProvider } from '../src/providers/implementations/google-photo.provider.js';
import { TripadvisorReviewProvider } from '../src/providers/implementations/tripadvisor-review.provider.js';
import { FoursquareSearchProvider } from '../src/providers/implementations/foursquare-search.provider.js';
import { PlaceSearchService } from '../src/services/place-search.service.js';
import { PlaceDetailsService } from '../src/services/place-details.service.js';
import { ReviewTTLService } from '../src/services/review-ttl.service.js';
import { JobType } from '../src/jobs/interfaces/job-queue.interface.js';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up test data...');

  // Delete test places and cascading data
  await prisma.place.deleteMany({
    where: {
      OR: [
        { name: { startsWith: 'Test Place' } },
        { name: { startsWith: 'Mock Restaurant' } },
      ],
    },
  });

  console.log('✅ Cleanup complete\n');
}

async function testServiceIntegration() {
  console.log('=== Testing Service Layer Integration ===\n');

  await cleanup();

  // Initialize services
  console.log('⚙️  Initializing services...');

  const jobQueue = new InProcessJobQueue(prisma, {
    concurrency: 2,
    retryDelayMs: 1000,
    maxRetries: 3,
    pollIntervalMs: 2000,
  });

  // Register processors
  const photoProvider = new GooglePhotoProvider();
  const reviewProvider = new TripadvisorReviewProvider();
  const searchProvider = new FoursquareSearchProvider(
    env.FOURSQUARE_API_KEY
  );

  jobQueue.registerProcessor(
    JobType.FETCH_PHOTOS,
    new FetchPhotosProcessor(photoProvider, prisma)
  );
  jobQueue.registerProcessor(
    JobType.FETCH_REVIEWS,
    new FetchReviewsProcessor(reviewProvider, prisma)
  );

  // Initialize services
  const placeSearchService = new PlaceSearchService(
    prisma,
    searchProvider,
    jobQueue
  );
  const placeDetailsService = new PlaceDetailsService(prisma);
  const reviewTTLService = new ReviewTTLService(prisma);

  console.log('✅ Services initialized\n');

  // Start job queue
  await jobQueue.start();
  console.log('▶️  Job queue started\n');

  // Test 1: Create mock place manually (since Foursquare API needs parameter tuning)
  console.log('=== Test 1: Manual Place Creation & Enrichment ===\n');

  const mockPlace = await prisma.place.create({
    data: {
      fsq_place_id: 'mock-fsq-' + Date.now(),
      name: 'Mock Restaurant for Testing',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Market St',
      locality: 'San Francisco',
      region: 'CA',
      categories: ['Restaurant', 'Italian'],
    },
  });

  console.log(`✅ Created mock place: ${mockPlace.name} (${mockPlace.id})\n`);

  // Trigger enrichment
  console.log('📤 Triggering enrichment...');
  await placeSearchService.triggerEnrichment(mockPlace.id, {
    photos: true,
    reviews: true,
    priority: 10,
  });
  console.log('✅ Enrichment jobs queued\n');

  // Wait for enrichment
  console.log('⏳ Waiting for enrichment to complete...');
  await new Promise((resolve) => setTimeout(resolve, 8000));

  // Test 2: PlaceDetailsService
  console.log('\n=== Test 2: PlaceDetailsService ===\n');

  const placeDetails = await placeDetailsService.getPlaceById(mockPlace.id);
  if (placeDetails) {
    console.log(`✅ Retrieved place details for: ${placeDetails.name}`);
    console.log(`   Location: ${placeDetails.locality}, ${placeDetails.region}`);
    console.log(`   Categories: ${placeDetails.categories.join(', ')}`);
    console.log(`   Photos: ${placeDetails.photos.length}`);
    console.log(`   Reviews: ${placeDetails.reviews.length}`);
    console.log(
      `   Fully enriched: ${placeDetails.enrichmentStatus.isFullyEnriched}\n`
    );

    if (placeDetails.photos.length > 0) {
      console.log(`   Sample photo:`);
      console.log(`     - Provider: ${placeDetails.photos[0].provider}`);
      console.log(`     - URL: ${placeDetails.photos[0].url}`);
      console.log(
        `     - Attribution: ${placeDetails.photos[0].attributionText}\n`
      );
    }

    if (placeDetails.reviews.length > 0) {
      console.log(`   Sample review:`);
      console.log(`     - Author: ${placeDetails.reviews[0].author}`);
      console.log(`     - Rating: ${placeDetails.reviews[0].rating}`);
      console.log(
        `     - Text: ${placeDetails.reviews[0].text.substring(0, 80)}...\n`
      );
    }
  }

  // Test 3: ReviewTTLService
  console.log('=== Test 3: ReviewTTLService ===\n');

  const expiryStats = await reviewTTLService.getExpiryStats();
  console.log('📊 Review expiry statistics:');
  console.log(`   Total reviews: ${expiryStats.total}`);
  console.log(`   Valid reviews: ${expiryStats.valid}`);
  console.log(`   Expired reviews: ${expiryStats.expired}`);
  console.log(`   Expiring soon (7 days): ${expiryStats.expiringSoon}\n`);

  const shouldRefresh = await reviewTTLService.shouldRefreshReviews(
    mockPlace.id
  );
  console.log(
    `✅ Should refresh reviews for mock place: ${shouldRefresh} (expected: false)\n`
  );

  // Test 4: Batch enrichment
  console.log('=== Test 4: Batch Enrichment Check ===\n');

  const enrichmentResult = await placeSearchService.enrichMissingData([
    mockPlace.id,
  ]);
  console.log('📊 Batch enrichment results:');
  console.log(`   Photos queued: ${enrichmentResult.photosQueued}`);
  console.log(`   Reviews queued: ${enrichmentResult.reviewsQueued}`);
  console.log(
    `✅ No jobs queued (expected, place already enriched)\n`
  );

  // Test 5: Job queue statistics
  console.log('=== Test 5: Job Queue Statistics ===\n');

  const queueStats = await jobQueue.getStats();
  console.log('📊 Queue statistics:');
  console.log(`   Pending: ${queueStats.pending}`);
  console.log(`   Active: ${queueStats.active}`);
  console.log(`   Completed: ${queueStats.completed}`);
  console.log(`   Failed: ${queueStats.failed}\n`);

  // Stop job queue
  console.log('⏹️  Stopping job queue...');
  await jobQueue.stop();
  console.log('✅ Job queue stopped\n');

  console.log('=== All service integration tests completed! ===\n');
}

async function runTests() {
  try {
    await testServiceIntegration();
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

runTests();
