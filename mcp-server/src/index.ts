import { VibeSearchMCPServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const server = new VibeSearchMCPServer();
    await server.start();

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start MCP server', { error });
    process.exit(1);
  }
}

main();
