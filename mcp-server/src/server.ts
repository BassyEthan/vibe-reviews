import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAIService } from './services/openai.service.js';
import { PineconeService } from './services/pinecone.service.js';
import { RAGService } from './services/rag.service.js';
import { searchByVibe } from './tools/search-by-vibe.js';
import { getVibeSummary } from './tools/get-vibe-summary.js';
import {
  searchByVibeInputSchema,
  getVibeSummaryInputSchema,
} from './schemas/tools.schema.js';
import { logger } from './utils/logger.js';
import { handleToolError } from './utils/error-handler.js';

export class VibeSearchMCPServer {
  private server: Server;
  private openaiService: OpenAIService;
  private pineconeService: PineconeService;
  private ragService: RAGService;

  constructor() {
    this.server = new Server(
      {
        name: 'vibe-search-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize services
    this.openaiService = new OpenAIService();
    this.pineconeService = new PineconeService();
    this.ragService = new RAGService(this.openaiService, this.pineconeService);

    this.setupHandlers();
    logger.info('Vibe Search MCP Server initialized');
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_by_vibe',
            description: 'Performs semantic vector search across restaurant reviews based on atmospheric intent and vibe. Use this to find restaurants matching a specific mood, ambiance, or atmosphere.',
            inputSchema: {
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
          {
            name: 'get_vibe_summary',
            description: 'Synthesizes raw review data into a natural language "Vibe Report" for a specific restaurant. Uses RAG to generate a cohesive summary of the restaurant\'s atmosphere and ambiance.',
            inputSchema: {
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
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_by_vibe': {
            const input = searchByVibeInputSchema.parse(args);
            const result = await searchByVibe(
              input,
              this.openaiService,
              this.pineconeService
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_vibe_summary': {
            const input = getVibeSummaryInputSchema.parse(args);
            const result = await getVibeSummary(input, this.ragService);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return handleToolError(error, name);
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Server started with stdio transport');
  }
}
