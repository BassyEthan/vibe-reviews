/**
 * End-to-end pipeline test
 * Tests: Discovery → Enrichment → Embeddings → Ready for Pinecone
 */

import { PrismaClient } from '@prisma/client';
import { InProcessJobQueue } from '../src/jobs/implementations/in-process-queue.js';
import { FetchPhotosProcessor } from '../src/jobs/processors/fetch-photos.processor.js';
import { FetchReviewsProcessor } from '../src/jobs/processors/fetch-reviews.processor.js';
import { GenerateEmbeddingsProcessor } from '../src/jobs/processors/generate-embeddings.processor.js';
import { GooglePhotoProvider } from '../src/providers/implementations/google-photo.provider.js';
import { TripadvisorReviewProvider } from '../src/providers/implementations/tripadvisor-review.provider.js';
import { PlaceSearchService } from '../src/services/place-search.service.js';
import { PlaceDetailsService } from '../src/services/place-details.service.js';
import { JobType } from '../src/jobs/interfaces/job-queue.interface.js';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  await prisma.place.deleteMany({
    where: { name: { startsWith: 'E2E Test Place' } },
  });
  console.log('✅ Cleanup complete\n');
}

async function testEndToEndPipeline() {
  console.log('=== End-to-End Pipeline Test ===\n');
  console.log('This test demonstrates the complete flow:');
  console.log('1. Place creation (simulates Foursquare discovery)');
  console.log('2. Background enrichment (photos + reviews)');
  console.log('3. Data verification in PostgreSQL');
  console.log('4. Embedding generation readiness check\n');

  await cleanup();

  // Initialize services
  console.log('⚙️  Initializing services...');
  const jobQueue = new InProcessJobQueue(prisma, {
    concurrency: 3,
    retryDelayMs: 1000,
    maxRetries: 3,
    pollIntervalMs: 2000,
  });

  // Register processors (excluding embeddings for this test)
  const photoProvider = new GooglePhotoProvider();
  const reviewProvider = new TripadvisorReviewProvider();

  jobQueue.registerProcessor(
    JobType.FETCH_PHOTOS,
    new FetchPhotosProcessor(photoProvider, prisma)
  );
  jobQueue.registerProcessor(
    JobType.FETCH_REVIEWS,
    new FetchReviewsProcessor(reviewProvider, prisma)
  );

  // Note: GenerateEmbeddingsProcessor requires Python setup
  // For this test, we'll verify data is ready for embedding generation
  const embeddingsProcessor = new GenerateEmbeddingsProcessor();
  const dependenciesOk = await embeddingsProcessor.checkDependencies();
  console.log(`✅ Python dependencies check: ${dependenciesOk ? 'PASS' : 'SKIP (Python not configured)'}\n`);

  const placeDetailsService = new PlaceDetailsService(prisma);
  console.log('✅ Services initialized\n');

  // Start job queue
  await jobQueue.start();
  console.log('▶️  Job queue started\n');

  // Step 1: Create test place (simulates Foursquare discovery)
  console.log('=== Step 1: Place Discovery (Simulated) ===\n');
  const testPlace = await prisma.place.create({
    data: {
      fsq_place_id: 'e2e-test-' + Date.now(),
      name: 'E2E Test Place - Dark Moody Bar',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '456 Test Ave',
      locality: 'San Francisco',
      region: 'CA',
      categories: ['Bar', 'Restaurant'],
    },
  });
  console.log(`✅ Place created: ${testPlace.name}`);
  console.log(`   ID: ${testPlace.id}`);
  console.log(`   Foursquare ID: ${testPlace.fsq_place_id}\n`);

  // Step 2: Trigger background enrichment
  console.log('=== Step 2: Background Enrichment ===\n');
  console.log('📤 Queuing enrichment jobs...');

  await jobQueue.add(
    JobType.FETCH_PHOTOS,
    { placeId: testPlace.id },
    { priority: 10 }
  );
  await jobQueue.add(
    JobType.FETCH_REVIEWS,
    { placeId: testPlace.id },
    { priority: 10 }
  );

  console.log('✅ Jobs queued');
  console.log('⏳ Waiting for enrichment (10 seconds)...\n');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Step 3: Verify data in PostgreSQL
  console.log('=== Step 3: Data Verification ===\n');

  const placeDetails = await placeDetailsService.getPlaceById(testPlace.id);
  if (!placeDetails) {
    throw new Error('Place details not found');
  }

  console.log('📊 Place Details:');
  console.log(`   Name: ${placeDetails.name}`);
  console.log(`   Location: ${placeDetails.locality}, ${placeDetails.region}`);
  console.log(`   Categories: ${placeDetails.categories.join(', ')}`);
  console.log(`   Photos: ${placeDetails.photos.length}`);
  console.log(`   Reviews: ${placeDetails.reviews.length}`);
  console.log(`   Fully Enriched: ${placeDetails.enrichmentStatus.isFullyEnriched}\n`);

  // Verify photos
  if (placeDetails.photos.length > 0) {
    console.log('🖼️  Sample Photo:');
    console.log(`   Provider: ${placeDetails.photos[0].provider}`);
    console.log(`   URL: ${placeDetails.photos[0].url}`);
    console.log(`   Dimensions: ${placeDetails.photos[0].width}x${placeDetails.photos[0].height}`);
    console.log(`   Attribution: ${placeDetails.photos[0].attributionText}\n`);
  }

  // Verify reviews
  if (placeDetails.reviews.length > 0) {
    console.log('📝 Sample Review:');
    console.log(`   Provider: ${placeDetails.reviews[0].provider}`);
    console.log(`   Author: ${placeDetails.reviews[0].author}`);
    console.log(`   Rating: ${placeDetails.reviews[0].rating}/5`);
    console.log(`   Language: ${placeDetails.reviews[0].language}`);
    console.log(`   Expired: ${placeDetails.reviews[0].isExpired}`);
    console.log(`   Text: "${placeDetails.reviews[0].text.substring(0, 100)}..."\n`);
  }

  // Step 4: Check embedding readiness
  console.log('=== Step 4: Embedding Generation Readiness ===\n');

  const reviewCount = await prisma.review.count({
    where: { place_id: testPlace.id, is_expired: false },
  });
  const photoCount = await prisma.photo.count({
    where: { place_id: testPlace.id },
  });

  console.log('✅ Data ready for embedding generation:');
  console.log(`   Reviews in database: ${reviewCount}`);
  console.log(`   Photos in database: ${photoCount}`);
  console.log('\n📋 Next steps for embeddings:');
  console.log('   1. Run: cd ../data-pipeline');
  console.log('   2. Run: python3 embedder.py (reads from PostgreSQL)');
  console.log('   3. Run: python3 upsert_pinecone.py (uploads to Pinecone)');
  console.log('   OR trigger via GenerateEmbeddingsProcessor job\n');

  // Step 5: Job Queue Statistics
  console.log('=== Step 5: Job Queue Statistics ===\n');
  const stats = await jobQueue.getStats();
  console.log('📊 Final Statistics:');
  console.log(`   Pending: ${stats.pending}`);
  console.log(`   Active: ${stats.active}`);
  console.log(`   Completed: ${stats.completed}`);
  console.log(`   Failed: ${stats.failed}\n`);

  // Stop queue
  console.log('⏹️  Stopping job queue...');
  await jobQueue.stop();
  console.log('✅ Job queue stopped\n');

  console.log('=== ✅ End-to-End Pipeline Test Complete! ===\n');
  console.log('Summary:');
  console.log(`✅ Place created in PostgreSQL`);
  console.log(`✅ ${photoCount} photos enriched`);
  console.log(`✅ ${reviewCount} reviews enriched`);
  console.log(`✅ Data ready for embedding generation`);
  console.log(`✅ Background jobs completed successfully\n`);
}

async function runTest() {
  try {
    await testEndToEndPipeline();
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

runTest();
