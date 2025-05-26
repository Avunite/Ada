import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

class Config {
  constructor() {
    this.validateRequiredEnvVars();
    this.loadSystemPrompt();
  }

  // Barkle configuration
  get barkleApiUrl() {
    return process.env.BARKLE_API_URL;
  }

  get barkleWssUrl() {
    return process.env.BARKLE_WSS_URL;
  }

  get barkleApiKey() {
    return process.env.BARKLE_API_KEY;
  }

  // Avunite AI service configuration
  get avuniteUrl() {
    return process.env.AVUNITE_URL;
  }

  get avuniteKey() {
    return process.env.AVUNITE_KEY;
  }

  get avuniteModel() {
    return process.env.AVUNITE_MODEL;
  }

  // Bot configuration
  get botUsername() {
    return process.env.BOT_USERNAME;
  }

  get botName() {
    return process.env.BOT_NAME || 'Ada Bot';
  }

  get systemPath() {
    return process.env.SYSTEM_PATH || './system.txt';
  }

  // Optional configuration
  get logLevel() {
    return process.env.LOG_LEVEL || 'warn';
  }

  get reconnectInterval() {
    return parseInt(process.env.RECONNECT_INTERVAL) || 5000;
  }

  get maxReconnectAttempts() {
    return parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10;
  }

  get systemPrompt() {
    return this._systemPrompt;
  }

  validateRequiredEnvVars() {
    const required = [
      'BARKLE_API_URL',
      'BARKLE_WSS_URL', 
      'BARKLE_API_KEY',
      'AVUNITE_URL',
      'AVUNITE_KEY',
      'AVUNITE_MODEL',
      'BOT_USERNAME'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  loadSystemPrompt() {
    try {
      const systemPath = path.resolve(this.systemPath);
      this._systemPrompt = fs.readFileSync(systemPath, 'utf8').trim();
    } catch (error) {
      console.warn(`Warning: Could not load system prompt from ${this.systemPath}:`, error.message);
      this._systemPrompt = 'You are Ada, a helpful AI assistant bot.';
    }
  }

  reloadSystemPrompt() {
    this.loadSystemPrompt();
  }
}

export default new Config();
