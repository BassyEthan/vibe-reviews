import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Core API Keys
  PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Provider API Keys
  FOURSQUARE_API_KEY: z.string().min(1, 'FOURSQUARE_API_KEY is required'),
  GOOGLE_PLACES_API_KEY: z.string().optional(), // Optional for Phase 2 (stub)
  TRIPADVISOR_API_KEY: z.string().optional(),   // Optional for Phase 2 (stub)

  // Configuration
  PINECONE_INDEX_NAME: z.string().default('vibe-search'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().default(512),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4-turbo-preview'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
}

export const env = validateEnv();
