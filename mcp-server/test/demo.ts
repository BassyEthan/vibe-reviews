#!/usr/bin/env tsx

import { OpenAIService } from '../src/services/openai.service.js';
import { PineconeService } from '../src/services/pinecone.service.js';
import { RAGService } from '../src/services/rag.service.js';
import { searchByVibe } from '../src/tools/search-by-vibe.js';
import { getVibeSummary } from '../src/tools/get-vibe-summary.js';
import { logger } from '../src/utils/logger.js';

async function runDemo() {
  logger.info('Starting MCP Server Demo');

  try {
    // Initialize services
    console.log('\n🚀 Initializing services...\n');
    const openaiService = new OpenAIService();
    const pineconeService = new PineconeService();
    const ragService = new RAGService(openaiService, pineconeService);

    console.log('✅ Services initialized successfully\n');
    console.log('=' .repeat(80));
    console.log('TEST 1: Search by Vibe');
    console.log('=' .repeat(80));

    const searchQueries = [
      'dark moody bar for date night',
      'bright sunny brunch spot',
      'romantic intimate atmosphere',
    ];

    for (const query of searchQueries) {
      console.log(`\n📍 Query: "${query}"\n`);

      const searchResult = await searchByVibe(
        { query, limit: 3 },
        openaiService,
        pineconeService
      );

      console.log(`✨ Found ${searchResult.total_results} results:\n`);

      if (searchResult.results.length === 0) {
        console.log('   No results found. Make sure you have data in Pinecone.');
      } else {
        searchResult.results.forEach((result, idx) => {
          console.log(`   ${idx + 1}. Score: ${result.score.toFixed(4)}`);
          console.log(`      Restaurant ID: ${result.restaurant_id}`);
          console.log(`      Rating: ${result.rating}/5 by ${result.author || 'Anonymous'}`);
          console.log(`      Text: ${result.text.substring(0, 80)}...`);
          console.log();
        });

        // Test get_vibe_summary for first result
        if (searchResult.results.length > 0) {
          const restaurantId = searchResult.results[0].restaurant_id;

          console.log('=' .repeat(80));
          console.log(`TEST 2: Get Vibe Summary for Restaurant ${restaurantId}`);
          console.log('=' .repeat(80));
          console.log();

          const summary = await getVibeSummary(
            { restaurant_id: restaurantId },
            ragService
          );

          console.log(`📝 Summary (based on ${summary.review_count} reviews):\n`);
          console.log(`   ${summary.summary}\n`);
          console.log(`📚 Sources:`);
          summary.sources.slice(0, 3).forEach((source, idx) => {
            console.log(`   ${idx + 1}. ${source.author} (${source.date}) - Rating: ${source.rating}/5`);
            console.log(`      "${source.text.substring(0, 60)}..."`);
          });
        }
      }

      console.log('\n' + '=' .repeat(80) + '\n');
    }

    logger.info('Demo completed successfully');
    console.log('✅ Demo completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Demo failed', { error });
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

runDemo();
