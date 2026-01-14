import { z } from 'zod';
import { logger } from './logger.js';

export function handleToolError(error: unknown, toolName: string) {
  logger.error(`Tool execution failed: ${toolName}`, { error });

  if (error instanceof z.ZodError) {
    const validationErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Validation Error',
            tool: toolName,
            details: validationErrors,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  if (error instanceof Error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: error.message,
            tool: toolName,
            type: error.constructor.name,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          error: 'Unknown error occurred',
          tool: toolName,
        }, null, 2),
      },
    ],
    isError: true,
  };
}
