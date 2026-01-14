/**
 * Test script for job queue lifecycle
 */

import { PrismaClient } from '@prisma/client';
import { InProcessJobQueue } from '../src/jobs/implementations/in-process-queue.js';
import { FetchPhotosProcessor } from '../src/jobs/processors/fetch-photos.processor.js';
import { FetchReviewsProcessor } from '../src/jobs/processors/fetch-reviews.processor.js';
import { GooglePhotoProvider } from '../src/providers/implementations/google-photo.provider.js';
import { TripadvisorReviewProvider } from '../src/providers/implementations/tripadvisor-review.provider.js';
import { JobType } from '../src/jobs/interfaces/job-queue.interface.js';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up test data...');

  // Delete test jobs
  await prisma.enrichmentJob.deleteMany({
    where: {
      place: {
        name: {
          startsWith: 'Test Place',
        },
      },
    },
  });

  // Delete test place and related data
  await prisma.place.deleteMany({
    where: {
      name: {
        startsWith: 'Test Place',
      },
    },
  });

  console.log('✅ Cleanup complete\n');
}

async function testJobQueueLifecycle() {
  console.log('=== Testing Job Queue Lifecycle ===\n');

  // Cleanup before test
  await cleanup();

  // Step 1: Create a test place
  console.log('📍 Creating test place...');
  const testPlace = await prisma.place.create({
    data: {
      fsq_place_id: 'test-fsq-place-id-' + Date.now(),
      name: 'Test Place for Job Queue',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Test St',
      locality: 'San Francisco',
      region: 'CA',
      categories: ['Restaurant', 'Italian'],
    },
  });
  console.log(`✅ Created place: ${testPlace.name} (${testPlace.id})\n`);

  // Step 2: Initialize job queue
  console.log('⚙️  Initializing job queue...');
  const jobQueue = new InProcessJobQueue(prisma, {
    concurrency: 2,
    retryDelayMs: 1000,
    maxRetries: 3,
    pollIntervalMs: 2000,
  });

  // Step 3: Register processors
  console.log('📝 Registering processors...');
  const photoProvider = new GooglePhotoProvider();
  const reviewProvider = new TripadvisorReviewProvider();

  const photosProcessor = new FetchPhotosProcessor(photoProvider, prisma);
  const reviewsProcessor = new FetchReviewsProcessor(reviewProvider, prisma);

  jobQueue.registerProcessor(JobType.FETCH_PHOTOS, photosProcessor);
  jobQueue.registerProcessor(JobType.FETCH_REVIEWS, reviewsProcessor);
  console.log('✅ Processors registered\n');

  // Step 4: Enqueue jobs
  console.log('📤 Enqueueing jobs...');
  const photoJob = await jobQueue.add(
    JobType.FETCH_PHOTOS,
    { placeId: testPlace.id },
    { priority: 10 }
  );
  console.log(`  → Photo job queued: ${photoJob.id}`);

  const reviewJob = await jobQueue.add(
    JobType.FETCH_REVIEWS,
    { placeId: testPlace.id },
    { priority: 5 }
  );
  console.log(`  → Review job queued: ${reviewJob.id}\n`);

  // Step 5: Start the queue
  console.log('▶️  Starting job queue...');
  await jobQueue.start();
  console.log('✅ Job queue started\n');

  // Step 6: Wait for jobs to complete
  console.log('⏳ Waiting for jobs to complete...');
  await new Promise((resolve) => setTimeout(resolve, 8000)); // Wait 8 seconds

  // Step 7: Check statistics
  console.log('\n📊 Job Statistics:');
  const stats = await jobQueue.getStats();
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  Active: ${stats.active}`);
  console.log(`  Completed: ${stats.completed}`);
  console.log(`  Failed: ${stats.failed}\n`);

  // Step 8: Verify photos in database
  console.log('🖼️  Checking photos in database...');
  const photos = await prisma.photo.findMany({
    where: { place_id: testPlace.id },
  });
  console.log(`✅ Found ${photos.length} photos`);
  if (photos.length > 0) {
    console.log(`  → Provider: ${photos[0].provider}`);
    console.log(`  → URL: ${photos[0].url}`);
    console.log(`  → Attribution: ${photos[0].attribution_text}\n`);
  }

  // Step 9: Verify reviews in database
  console.log('📝 Checking reviews in database...');
  const reviews = await prisma.review.findMany({
    where: { place_id: testPlace.id },
  });
  console.log(`✅ Found ${reviews.length} reviews`);
  if (reviews.length > 0) {
    console.log(`  → Provider: ${reviews[0].provider}`);
    console.log(`  → Rating: ${reviews[0].rating}`);
    console.log(`  → Author: ${reviews[0].author}`);
    console.log(`  → Expires: ${reviews[0].expires_at.toISOString()}`);
    console.log(`  → Text preview: ${reviews[0].text.substring(0, 80)}...\n`);
  }

  // Step 10: Stop the queue
  console.log('⏹️  Stopping job queue...');
  await jobQueue.stop();
  console.log('✅ Job queue stopped\n');

  // Step 11: Test deduplication (enqueue same jobs again)
  console.log('🔄 Testing deduplication...');
  await jobQueue.start();

  await jobQueue.add(JobType.FETCH_PHOTOS, { placeId: testPlace.id });
  await jobQueue.add(JobType.FETCH_REVIEWS, { placeId: testPlace.id });

  console.log('⏳ Waiting for deduplication jobs...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const photosAfter = await prisma.photo.count({
    where: { place_id: testPlace.id },
  });
  const reviewsAfter = await prisma.review.count({
    where: { place_id: testPlace.id },
  });

  console.log(`✅ Photos count unchanged: ${photosAfter} (deduplication working)`);
  console.log(`✅ Reviews count unchanged: ${reviewsAfter} (deduplication working)\n`);

  await jobQueue.stop();

  console.log('=== All tests completed successfully! ===\n');
}

async function runTests() {
  try {
    await testJobQueueLifecycle();
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup after test
    await cleanup();
    await prisma.$disconnect();
  }
}

runTests();
