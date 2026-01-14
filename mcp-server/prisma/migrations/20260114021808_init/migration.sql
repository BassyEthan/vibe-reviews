-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FETCH_PHOTOS', 'FETCH_REVIEWS', 'GENERATE_EMBEDDINGS');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "fsq_place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "categories" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "external_photo_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "attribution_text" TEXT NOT NULL,
    "attribution_url" TEXT,
    "html_attribution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'tripadvisor',
    "external_review_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "author" TEXT NOT NULL,
    "published_date" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "helpful_votes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_expired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_jobs" (
    "id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),

    CONSTRAINT "enrichment_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_rate_limits" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requests_today" INTEGER NOT NULL DEFAULT 0,
    "daily_limit" INTEGER NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "places_fsq_place_id_key" ON "places"("fsq_place_id");

-- CreateIndex
CREATE INDEX "places_fsq_place_id_idx" ON "places"("fsq_place_id");

-- CreateIndex
CREATE INDEX "places_locality_region_idx" ON "places"("locality", "region");

-- CreateIndex
CREATE INDEX "photos_place_id_idx" ON "photos"("place_id");

-- CreateIndex
CREATE UNIQUE INDEX "photos_place_id_external_photo_id_key" ON "photos"("place_id", "external_photo_id");

-- CreateIndex
CREATE INDEX "reviews_place_id_idx" ON "reviews"("place_id");

-- CreateIndex
CREATE INDEX "reviews_expires_at_idx" ON "reviews"("expires_at");

-- CreateIndex
CREATE INDEX "reviews_is_expired_place_id_idx" ON "reviews"("is_expired", "place_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_place_id_external_review_id_key" ON "reviews"("place_id", "external_review_id");

-- CreateIndex
CREATE INDEX "enrichment_jobs_status_priority_created_at_idx" ON "enrichment_jobs"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "enrichment_jobs_place_id_job_type_idx" ON "enrichment_jobs"("place_id", "job_type");

-- CreateIndex
CREATE UNIQUE INDEX "provider_rate_limits_provider_key" ON "provider_rate_limits"("provider");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_jobs" ADD CONSTRAINT "enrichment_jobs_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;
