/**
 * OpenAI ChatGPT Integration
 * Converts MCP tools to OpenAI function calling format
 */

import OpenAI from 'openai';
import { env } from './config/env.js';
import { OpenAIService } from './services/openai.service.js';
import { PineconeService } from './services/pinecone.service.js';
import { RAGService } from './services/rag.service.js';
import { searchByVibe } from './tools/search-by-vibe.js';
import { getVibeSummary } from './tools/get-vibe-summary.js';
import { logger } from './utils/logger.js';

// Convert MCP tools to OpenAI function definitions
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_by_vibe',
      description: 'Performs semantic vector search across restaurant reviews based on atmospheric intent and vibe. Use this to find restaurants matching a specific mood, ambiance, or atmosphere.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The vibe/atmosphere query (e.g., "dark moody bar for date night")',
          },
          location: {
            type: 'string',
            description: 'Optional location filter (e.g., "Berkeley, CA")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vibe_summary',
      description: 'Synthesizes raw review data into a natural language "Vibe Report" for a specific restaurant. Uses RAG to generate a cohesive summary of the restaurant\'s atmosphere and ambiance.',
      parameters: {
        type: 'object',
        properties: {
          restaurant_id: {
            type: 'string',
            description: 'The unique restaurant identifier',
          },
        },
        required: ['restaurant_id'],
      },
    },
  },
];

export class VibeSearchChatGPT {
  private client: OpenAI;
  private openaiService: OpenAIService;
  private pineconeService: PineconeService;
  private ragService: RAGService;
  private messages: OpenAI.ChatCompletionMessageParam[] = [];

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.openaiService = new OpenAIService();
    this.pineconeService = new PineconeService();
    this.ragService = new RAGService(this.openaiService, this.pineconeService);

    // System prompt
    this.messages.push({
      role: 'system',
      content: `You are a helpful restaurant discovery assistant that helps people find restaurants based on their desired vibe, atmosphere, and mood. 

Use the search_by_vibe tool to find restaurants matching what the user is looking for. You can then use get_vibe_summary to provide more detailed information about specific restaurants.

Be conversational, helpful, and provide clear recommendations based on the search results.`,
    });

    logger.info('VibeSearch ChatGPT integration initialized');
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolName: string, args: any): Promise<string> {
    try {
      switch (toolName) {
        case 'search_by_vibe': {
          const result = await searchByVibe(args, this.openaiService, this.pineconeService);
          return JSON.stringify(result, null, 2);
        }

        case 'get_vibe_summary': {
          const result = await getVibeSummary(args, this.ragService);
          return JSON.stringify(result, null, 2);
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${toolName}` });
      }
    } catch (error) {
      logger.error('Tool execution failed', { toolName, error });
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Chat with ChatGPT using the vibe search tools
   */
  async chat(userMessage: string): Promise<string> {
    // Add user message
    this.messages.push({ role: 'user', content: userMessage });

    try {
      // Get response from ChatGPT (may include function calls)
      const response = await this.client.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        messages: this.messages,
        tools: tools,
        tool_choice: 'auto', // Let ChatGPT decide when to use tools
        temperature: 0.7,
      });

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error('No response from OpenAI');
      }

      // Add assistant's message (might include tool calls)
      this.messages.push(message);

      // If ChatGPT wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Execute all tool calls
        const toolResults: OpenAI.ChatCompletionMessageParam[] = [];

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          logger.info('Executing tool', { toolName, args });

          const result = await this.executeTool(toolName, args);

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Add tool results to conversation
        this.messages.push(...toolResults);

        // Get final response from ChatGPT with tool results
        const finalResponse = await this.client.chat.completions.create({
          model: env.OPENAI_CHAT_MODEL,
          messages: this.messages,
          tools: tools,
          temperature: 0.7,
        });

        const finalMessage = finalResponse.choices[0]?.message;

        if (!finalMessage?.content) {
          throw new Error('No final response from OpenAI');
        }

        // Add final response to conversation
        this.messages.push(finalMessage);

        return finalMessage.content;
      }

      // No tool calls, just return the response
      return message.content || 'No response';
    } catch (error) {
      logger.error('Chat failed', { error });
      throw error;
    }
  }

  /**
   * Reset conversation history
   */
  reset(): void {
    this.messages = [
      {
        role: 'system',
        content: `You are a helpful restaurant discovery assistant that helps people find restaurants based on their desired vibe, atmosphere, and mood. 

Use the search_by_vibe tool to find restaurants matching what the user is looking for. You can then use get_vibe_summary to provide more detailed information about specific restaurants.

Be conversational, helpful, and provide clear recommendations based on the search results.`,
      },
    ];
    logger.info('Conversation reset');
  }
}
