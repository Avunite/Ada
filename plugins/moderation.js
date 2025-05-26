import BasePlugin from './base-plugin.js';

/**
 * Moderation Plugin
 * Provides basic moderation features like spam detection and rate limiting
 */
export default class ModerationPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'Moderation';
    this.version = '1.0.0';
    this.description = 'Basic moderation features including spam detection and rate limiting';
    
    this.userMessages = new Map(); // Track user messages for rate limiting
    this.rateLimitWindow = 60000; // 1 minute
    this.maxMessagesPerWindow = 10;
    
    this.spamKeywords = [
      'spam', 'scam', 'free money', 'click here', 'winner', 'congratulations'
    ];

    // Register hooks
    this.hooks = {
      'beforeProcess': this.handleBeforeProcess.bind(this),
      'afterResponse': this.handleAfterResponse.bind(this)
    };
  }

  async initialize() {
    this.info('Moderation plugin initialized');
    
    // Clean up old message history every 5 minutes
    setInterval(() => {
      this.cleanupMessageHistory();
    }, 5 * 60 * 1000);
  }

  async handleBeforeProcess(data, context) {
    const { note } = data;
    
    if (!note || !note.user) {
      return data;
    }

    const userId = note.user.id;
    const now = Date.now();
    
    // Check rate limiting
    if (this.isRateLimited(userId, now)) {
      this.warn(`Rate limit exceeded for user ${note.user.username}`);
      return {
        ...data,
        blocked: true,
        reason: 'rate_limit'
      };
    }

    // Check for spam
    if (this.isSpam(note.text)) {
      this.warn(`Spam detected from user ${note.user.username}`);
      return {
        ...data,
        blocked: true,
        reason: 'spam'
      };
    }

    // Track this message
    this.trackMessage(userId, now);

    return data;
  }

  async handleAfterResponse(data, context) {
    // Log interaction for analysis
    const { note, response } = data;
    
    if (note && note.user) {
      this.debug(`Interaction logged: ${note.user.username} -> response sent`);
    }

    return data;
  }

  isRateLimited(userId, timestamp) {
    if (!this.userMessages.has(userId)) {
      return false;
    }

    const userHistory = this.userMessages.get(userId);
    const recentMessages = userHistory.filter(
      msgTime => timestamp - msgTime < this.rateLimitWindow
    );

    return recentMessages.length >= this.maxMessagesPerWindow;
  }

  isSpam(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    
    return this.spamKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  trackMessage(userId, timestamp) {
    if (!this.userMessages.has(userId)) {
      this.userMessages.set(userId, []);
    }

    this.userMessages.get(userId).push(timestamp);
  }

  cleanupMessageHistory() {
    const now = Date.now();
    const cutoff = now - this.rateLimitWindow;

    for (const [userId, messages] of this.userMessages.entries()) {
      const recentMessages = messages.filter(msgTime => msgTime > cutoff);
      
      if (recentMessages.length === 0) {
        this.userMessages.delete(userId);
      } else {
        this.userMessages.set(userId, recentMessages);
      }
    }

    this.debug('Cleaned up old message history');
  }

  addSpamKeyword(keyword) {
    if (!this.spamKeywords.includes(keyword.toLowerCase())) {
      this.spamKeywords.push(keyword.toLowerCase());
    }
  }

  removeSpamKeyword(keyword) {
    const index = this.spamKeywords.indexOf(keyword.toLowerCase());
    if (index > -1) {
      this.spamKeywords.splice(index, 1);
    }
  }

  setRateLimit(maxMessages, windowMs) {
    this.maxMessagesPerWindow = maxMessages;
    this.rateLimitWindow = windowMs;
  }
}
