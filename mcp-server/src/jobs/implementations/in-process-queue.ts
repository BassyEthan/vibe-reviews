/**
 * In-Process Job Queue
 *
 * Lightweight job queue implementation with Prisma persistence.
 * Designed for easy migration to Bull/BullMQ when scaling is needed.
 */

import { PrismaClient, JobType as PrismaJobType, JobStatus } from '@prisma/client';
import {
  IJobQueue,
  Job,
  JobType,
  JobProcessor,
  JobQueueConfig,
} from '../interfaces/job-queue.interface.js';
import { logger } from '../../utils/logger.js';

export class InProcessJobQueue implements IJobQueue {
  private processors: Map<JobType, JobProcessor> = new Map();
  private isRunning: boolean = false;
  private activeJobs: Set<string> = new Set();
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaClient,
    private config: JobQueueConfig
  ) {}

  async add<T>(
    type: JobType,
    data: T,
    options?: { priority?: number }
  ): Promise<Job<T>> {
    const job = await this.prisma.enrichmentJob.create({
      data: {
        place_id: (data as any).placeId, // Extract from data
        job_type: type as any as PrismaJobType,
        status: JobStatus.PENDING,
        priority: options?.priority || 0,
        max_attempts: this.config.maxRetries,
      },
    });

    logger.info('Job queued', {
      jobId: job.id,
      type,
      priority: job.priority,
    });

    return {
      id: job.id,
      type: type,
      data,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      createdAt: job.created_at,
    };
  }

  registerProcessor(type: JobType, processor: JobProcessor): void {
    this.processors.set(type, processor);
    logger.info('Processor registered', { type });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Job queue already running');
      return;
    }

    this.isRunning = true;
    logger.info('Job queue started', {
      concurrency: this.config.concurrency,
      pollIntervalMs: this.config.pollIntervalMs,
    });

    this.pollTimer = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      logger.info('Waiting for active jobs to complete', {
        count: this.activeJobs.size,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info('Job queue stopped');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning || this.activeJobs.size >= this.config.concurrency) {
      return;
    }

    const availableSlots = this.config.concurrency - this.activeJobs.size;

    // Fetch pending jobs, prioritized
    const jobs = await this.prisma.enrichmentJob.findMany({
      where: {
        status: JobStatus.PENDING,
        OR: [
          { next_retry_at: null },
          { next_retry_at: { lte: new Date() } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
      take: availableSlots,
      include: {
        place: true, // Include place data for processing
      },
    });

    for (const job of jobs) {
      this.processJob(job);
    }
  }

  private async processJob(dbJob: any): Promise<void> {
    const jobId = dbJob.id;
    this.activeJobs.add(jobId);

    // Mark as in progress
    await this.prisma.enrichmentJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.IN_PROGRESS,
        started_at: new Date(),
        attempts: { increment: 1 },
      },
    });

    const processor = this.processors.get(dbJob.job_type as JobType);
    if (!processor) {
      logger.error('No processor registered for job type', {
        type: dbJob.job_type,
      });
      this.activeJobs.delete(jobId);
      return;
    }

    try {
      const job: Job = {
        id: jobId,
        type: dbJob.job_type as JobType,
        data: { placeId: dbJob.place_id, place: dbJob.place },
        priority: dbJob.priority,
        attempts: dbJob.attempts,
        maxAttempts: dbJob.max_attempts,
        createdAt: dbJob.created_at,
        startedAt: dbJob.started_at,
      };

      await processor.process(job);

      // Mark as completed
      await this.prisma.enrichmentJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          completed_at: new Date(),
        },
      });

      logger.info('Job completed', { jobId, type: dbJob.job_type });
    } catch (error) {
      logger.error('Job failed', {
        jobId,
        type: dbJob.job_type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Handle retry logic
      const shouldRetry = dbJob.attempts < dbJob.max_attempts;

      if (shouldRetry) {
        const delay = this.config.retryDelayMs * Math.pow(2, dbJob.attempts);
        const nextRetryAt = new Date(Date.now() + delay);

        await this.prisma.enrichmentJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.PENDING,
            last_error:
              error instanceof Error ? error.message : 'Unknown error',
            next_retry_at: nextRetryAt,
          },
        });

        logger.info('Job scheduled for retry', {
          jobId,
          nextRetryAt,
          attempt: dbJob.attempts,
        });
      } else {
        await this.prisma.enrichmentJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            last_error:
              error instanceof Error ? error.message : 'Unknown error',
          },
        });

        logger.error('Job failed permanently', {
          jobId,
          attempts: dbJob.attempts,
        });
      }
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    const dbJob = await this.prisma.enrichmentJob.findUnique({
      where: { id: jobId },
    });

    if (!dbJob) return null;

    return {
      id: dbJob.id,
      type: dbJob.job_type as JobType,
      data: { placeId: dbJob.place_id },
      priority: dbJob.priority,
      attempts: dbJob.attempts,
      maxAttempts: dbJob.max_attempts,
      createdAt: dbJob.created_at,
      startedAt: dbJob.started_at || undefined,
      completedAt: dbJob.completed_at || undefined,
      error: dbJob.last_error || undefined,
    };
  }

  async getStats(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [pending, active, completed, failed] = await Promise.all([
      this.prisma.enrichmentJob.count({
        where: { status: JobStatus.PENDING },
      }),
      this.prisma.enrichmentJob.count({
        where: { status: JobStatus.IN_PROGRESS },
      }),
      this.prisma.enrichmentJob.count({
        where: { status: JobStatus.COMPLETED },
      }),
      this.prisma.enrichmentJob.count({ where: { status: JobStatus.FAILED } }),
    ]);

    return { pending, active, completed, failed };
  }
}
