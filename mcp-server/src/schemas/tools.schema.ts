import { z } from 'zod';

// search_by_vibe tool schemas
export const searchByVibeInputSchema = z.object({
  query: z.string().min(1, 'Query must not be empty').describe('The vibe/atmosphere query (e.g., "dark moody bar for date night")'),
  location: z.string().optional().describe('Optional location filter (e.g., "Berkeley, CA")'),
  limit: z.number().int().positive().default(5).describe('Maximum number of results to return (default: 5)'),
});

export const searchByVibeOutputSchema = z.object({
  results: z.array(
    z.object({
      restaurant_id: z.string(),
      text: z.string(),
      score: z.number(),
      rating: z.number().optional(),
      author: z.string().optional(),
      date: z.string().optional(),
    })
  ),
  query: z.string(),
  total_results: z.number(),
});

export type SearchByVibeInput = z.infer<typeof searchByVibeInputSchema>;
export type SearchByVibeOutput = z.infer<typeof searchByVibeOutputSchema>;

// get_vibe_summary tool schemas
export const getVibeSummaryInputSchema = z.object({
  restaurant_id: z.string().min(1, 'Restaurant ID must not be empty').describe('The unique restaurant identifier'),
});

export const getVibeSummaryOutputSchema = z.object({
  restaurant_id: z.string(),
  summary: z.string(),
  review_count: z.number(),
  sources: z.array(
    z.object({
      text: z.string(),
      rating: z.number(),
      author: z.string(),
      date: z.string(),
    })
  ),
});

export type GetVibeSummaryInput = z.infer<typeof getVibeSummaryInputSchema>;
export type GetVibeSummaryOutput = z.infer<typeof getVibeSummaryOutputSchema>;
