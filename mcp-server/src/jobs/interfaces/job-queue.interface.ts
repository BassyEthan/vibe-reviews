/**
 * Job Queue Interface
 *
 * Interface for background job processing.
 * Designed to be compatible with Bull/BullMQ for future migration.
 */

export enum JobType {
  FETCH_PHOTOS = 'FETCH_PHOTOS',
  FETCH_REVIEWS = 'FETCH_REVIEWS',
  GENERATE_EMBEDDINGS = 'GENERATE_EMBEDDINGS',
}

export interface Job<T = any> {
  id: string;
  type: JobType;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  nextRetryAt?: Date;
}

export interface JobProcessor<T = any> {
  /**
   * Process a job. Throws error if job fails.
   */
  process(job: Job<T>): Promise<void>;
}

export interface JobQueueConfig {
  concurrency: number; // Max jobs running in parallel
  retryDelayMs: number; // Base delay for exponential backoff
  maxRetries: number;
  pollIntervalMs: number; // How often to check for new jobs
}

export interface IJobQueue {
  /**
   * Add a job to the queue.
   */
  add<T>(
    type: JobType,
    data: T,
    options?: { priority?: number }
  ): Promise<Job<T>>;

  /**
   * Register a processor for a job type.
   */
  registerProcessor(type: JobType, processor: JobProcessor): void;

  /**
   * Start processing jobs.
   */
  start(): Promise<void>;

  /**
   * Stop processing jobs gracefully.
   */
  stop(): Promise<void>;

  /**
   * Get job by ID.
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * Get queue statistics.
   */
  getStats(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }>;
}
