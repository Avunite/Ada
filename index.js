#!/usr/bin/env node

import AdaBot from './bot.js';
import logger from './logger.js';
import config from './config.js';

async function main() {
  console.log('🤖 Ada Bot - Barkle AI Assistant');
  console.log('================================');
  console.log(`Bot Name: ${config.botName}`);
  console.log(`Bot Username: ${config.botUsername}`);
  console.log(`Barkle API: ${config.barkleApiUrl}`);
  console.log(`AI Service: ${config.avuniteUrl}`);
  console.log('================================\n');

  const bot = new AdaBot();

  try {
    await bot.start();
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...');
      await bot.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle CLI commands
if (process.argv.length > 2) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'help':
      console.log(`
Ada Bot Commands:
  start          Start the bot (default)
  help           Show this help message
  version        Show version information

Environment Variables:
  See .env file for configuration options

Examples:
  npm start      Start the bot
  node index.js  Start the bot
      `);
      process.exit(0);
      break;

    case 'version':
      console.log('Ada Bot v1.0.0');
      process.exit(0);
      break;

    case 'start':
    default:
      main();
      break;
  }
} else {
  main();
}
