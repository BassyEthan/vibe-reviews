import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    logger.info('OpenAI service initialized');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: text,
        dimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
      });

      logger.debug('Generated embedding', { textLength: text.length });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error });
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateCompletion(
    systemPrompt: string,
    userMessage: string,
    context?: string[]
  ): Promise<string> {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (context && context.length > 0) {
        messages.push({
          role: 'user',
          content: `Context:\n${context.join('\n\n---\n\n')}`,
        });
      }

      messages.push({ role: 'user', content: userMessage });

      const response = await this.client.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      logger.debug('Generated completion', {
        messageLength: userMessage.length,
        responseLength: content.length
      });

      return content;
    } catch (error) {
      logger.error('Failed to generate completion', { error });
      throw new Error(`Completion generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
