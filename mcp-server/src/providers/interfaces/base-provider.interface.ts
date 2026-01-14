/**
 * Base Provider Interface
 *
 * Abstract base class for all API providers.
 * Provides rate limiting and common configuration.
 */

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  rateLimitPerSecond: number;
  timeoutMs: number;
}

export interface RateLimitState {
  requestCount: number;
  windowStart: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected rateLimitState: RateLimitState;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.rateLimitState = { requestCount: 0, windowStart: Date.now() };
  }

  /**
   * Enforce rate limiting before making API calls.
   * Blocks until rate limit window resets if needed.
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowElapsed = now - this.rateLimitState.windowStart;

    // Reset window every second
    if (windowElapsed >= 1000) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = now;
      return;
    }

    // Check if we've exceeded rate limit
    if (this.rateLimitState.requestCount >= this.config.rateLimitPerSecond) {
      const waitTime = 1000 - windowElapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = Date.now();
    }

    this.rateLimitState.requestCount++;
  }

  /**
   * Get provider name for logging.
   */
  abstract getProviderName(): string;
}
