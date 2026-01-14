/**
 * Simple CLI interface for ChatGPT integration
 * Run with: npm run chat
 */

import readline from 'readline';
import { VibeSearchChatGPT } from './openai-chat.js';
import { logger } from './utils/logger.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🍽️  Vibe Search ChatGPT Integration\n');
  console.log('Type your questions about restaurants. Type "quit" or "exit" to end.\n');

  const chat = new VibeSearchChatGPT();

  while (true) {
    const userInput = await askQuestion('You: ');

    if (!userInput || ['quit', 'exit', 'q'].includes(userInput.toLowerCase())) {
      console.log('\n👋 Goodbye!');
      break;
    }

    if (userInput.toLowerCase() === 'reset') {
      chat.reset();
      console.log('🔄 Conversation reset\n');
      continue;
    }

    try {
      process.stdout.write('ChatGPT: ');
      const response = await chat.chat(userInput);
      console.log(response);
      console.log(); // Empty line for readability
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log();
    }
  }

  rl.close();
}

main().catch((error) => {
  logger.error('CLI failed', { error });
  process.exit(1);
});
