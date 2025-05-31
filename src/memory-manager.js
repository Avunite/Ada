import logger from './logger.js';
import databaseManager from './database-manager.js';

/**
 * Memory Manager
 * Handles intelligent storage and retrieval of user memories
 * Provides context-aware memory management for the bot
 */
class MemoryManager {
  constructor() {
    this.memoryTypes = {
      PREFERENCE: 'preference',     // User preferences and settings
      FACT: 'fact',                // Facts about the user
      CONVERSATION: 'conversation', // Important conversation context
      RELATIONSHIP: 'relationship', // Relationship dynamics
      INTEREST: 'interest',        // User interests and hobbies
      GOAL: 'goal',               // User goals and aspirations
      EXPERIENCE: 'experience',    // Shared experiences or stories
      REMINDER: 'reminder'        // Things to remember for later
    };

    // Keywords that suggest important memory content
    this.importanceKeywords = {
      high: ['important', 'remember', 'never forget', 'always', 'love', 'hate', 'favorite', 'birthday', 'anniversary'],
      medium: ['like', 'enjoy', 'prefer', 'usually', 'often', 'sometimes', 'work', 'live', 'family'],
      low: ['maybe', 'perhaps', 'might', 'could', 'sometimes']
    };
  }

  /**
   * Analyze message content and extract potential memories
   * @param {string} userId - The user ID
   * @param {string} messageContent - The message to analyze
   * @param {Object} context - Additional context (userProfile, etc.)
   */
  async analyzeAndStoreMemories(userId, messageContent, context = {}) {
    try {
      const memories = this.extractMemories(messageContent, context);
      
      for (const memory of memories) {
        await databaseManager.storeMemory(
          userId,
          memory.key,
          memory.value,
          memory.type,
          memory.importance
        );
      }

      if (memories.length > 0) {
        logger.info(`Stored ${memories.length} memories for user ${userId}`);
      }

      return memories;
    } catch (error) {
      logger.error('Error analyzing and storing memories:', error.message);
      return [];
    }
  }

  /**
   * Extract potential memories from message content
   * @param {string} content - Message content to analyze
   * @param {Object} context - Additional context
   */
  extractMemories(content, context = {}) {
    const memories = [];
    const lowerContent = content.toLowerCase();

    // Extract preferences
    const preferencePatterns = [
      /i (love|like|enjoy|prefer|hate|dislike) (.+?)(?:\.|$|,)/gi,
      /my favorite (.+?) is (.+?)(?:\.|$|,)/gi,
      /i usually (.+?)(?:\.|$|,)/gi,
      /i always (.+?)(?:\.|$|,)/gi,
      /i never (.+?)(?:\.|$|,)/gi
    ];

    preferencePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = `preference_${this.generateKey(match[0])}`;
        memories.push({
          key,
          value: match[0].trim(),
          type: this.memoryTypes.PREFERENCE,
          importance: this.calculateImportance(match[0])
        });
      }
    });

    // Extract personal facts
    const factPatterns = [
      /i am (.+?)(?:\.|$|,)/gi,
      /i work as (.+?)(?:\.|$|,)/gi,
      /i live in (.+?)(?:\.|$|,)/gi,
      /my (.+?) is (.+?)(?:\.|$|,)/gi,
      /i have (.+?)(?:\.|$|,)/gi,
      /i'm (.+?)(?:\.|$|,)/gi
    ];

    factPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = `fact_${this.generateKey(match[0])}`;
        memories.push({
          key,
          value: match[0].trim(),
          type: this.memoryTypes.FACT,
          importance: this.calculateImportance(match[0])
        });
      }
    });

    // Extract interests and hobbies
    const interestPatterns = [
      /i'm into (.+?)(?:\.|$|,)/gi,
      /i play (.+?)(?:\.|$|,)/gi,
      /i collect (.+?)(?:\.|$|,)/gi,
      /i'm learning (.+?)(?:\.|$|,)/gi,
      /i study (.+?)(?:\.|$|,)/gi
    ];

    interestPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = `interest_${this.generateKey(match[0])}`;
        memories.push({
          key,
          value: match[0].trim(),
          type: this.memoryTypes.INTEREST,
          importance: this.calculateImportance(match[0])
        });
      }
    });

    // Extract important conversation context
    if (lowerContent.includes('remember') || lowerContent.includes('important')) {
      const key = `conversation_${Date.now()}`;
      memories.push({
        key,
        value: content.trim(),
        type: this.memoryTypes.CONVERSATION,
        importance: 8
      });
    }

    return memories;
  }

  /**
   * Generate a unique key for a memory based on content
   * @param {string} content - The content to generate a key for
   */
  generateKey(content) {
    return content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  /**
   * Calculate importance score based on content
   * @param {string} content - The content to analyze
   */
  calculateImportance(content) {
    const lowerContent = content.toLowerCase();
    
    // Check for high importance keywords
    for (const keyword of this.importanceKeywords.high) {
      if (lowerContent.includes(keyword)) {
        return 9;
      }
    }

    // Check for medium importance keywords
    for (const keyword of this.importanceKeywords.medium) {
      if (lowerContent.includes(keyword)) {
        return 6;
      }
    }

    // Check for low importance keywords
    for (const keyword of this.importanceKeywords.low) {
      if (lowerContent.includes(keyword)) {
        return 3;
      }
    }

    return 5; // Default importance
  }

  /**
   * Get relevant memories for context
   * @param {string} userId - The user ID
   * @param {string} currentMessage - Current message for context
   * @param {number} limit - Maximum memories to return
   */
  async getRelevantMemories(userId, currentMessage = '', limit = 10) {
    try {
      // Get all user memories
      const allMemories = await databaseManager.getUserMemories(userId, 100);
      
      if (allMemories.length === 0) {
        return [];
      }

      // If no current message, return most important memories
      if (!currentMessage) {
        return allMemories.slice(0, limit);
      }

      // Score memories based on relevance to current message
      const scoredMemories = allMemories.map(memory => {
        const relevanceScore = this.calculateRelevance(memory, currentMessage);
        return {
          ...memory,
          relevance_score: relevanceScore * memory.importance
        };
      });

      // Sort by combined relevance and importance score
      scoredMemories.sort((a, b) => b.relevance_score - a.relevance_score);

      return scoredMemories.slice(0, limit);
    } catch (error) {
      logger.error('Error getting relevant memories:', error.message);
      return [];
    }
  }

  /**
   * Calculate relevance score between memory and current message
   * @param {Object} memory - The memory object
   * @param {string} message - Current message
   */
  calculateRelevance(memory, message) {
    const memoryWords = memory.memory_value.toLowerCase().split(/\s+/);
    const messageWords = message.toLowerCase().split(/\s+/);
    
    let matchCount = 0;
    for (const word of memoryWords) {
      if (messageWords.some(mWord => mWord.includes(word) || word.includes(mWord))) {
        matchCount++;
      }
    }

    return matchCount / memoryWords.length;
  }

  /**
   * Format memories for AI context
   * @param {Array} memories - Array of memory objects
   */
  formatMemoriesForContext(memories) {
    if (!memories || memories.length === 0) {
      return '';
    }

    const memoryText = memories.map(memory => {
      const importance = memory.importance > 7 ? '[IMPORTANT] ' : '';
      return `${importance}${memory.memory_value}`;
    }).join('\n');

    return `\nUser Memories:\n${memoryText}`;
  }

  /**
   * Manually store a specific memory
   * @param {string} userId - The user ID
   * @param {string} key - Memory key
   * @param {string} value - Memory value
   * @param {string} type - Memory type
   * @param {number} importance - Importance level
   */
  async storeSpecificMemory(userId, key, value, type = this.memoryTypes.FACT, importance = 5) {
    try {
      await databaseManager.storeMemory(userId, key, value, type, importance);
      logger.info(`Manually stored memory for user ${userId}: ${key}`);
      return true;
    } catch (error) {
      logger.error('Error storing specific memory:', error.message);
      return false;
    }
  }

  /**
   * Search for memories related to a topic
   * @param {string} userId - The user ID
   * @param {string} topic - Topic to search for
   * @param {number} limit - Maximum results
   */
  async searchRelatedMemories(userId, topic, limit = 5) {
    try {
      return await databaseManager.searchMemories(userId, topic, limit);
    } catch (error) {
      logger.error('Error searching related memories:', error.message);
      return [];
    }
  }

  /**
   * Get memory statistics for a user
   * @param {string} userId - The user ID
   */
  async getMemoryStatistics(userId) {
    try {
      return await databaseManager.getMemoryStats(userId);
    } catch (error) {
      logger.error('Error getting memory statistics:', error.message);
      return null;
    }
  }

  /**
   * Clean up old, low-importance memories
   * @param {string} userId - The user ID
   * @param {number} maxMemories - Maximum memories to keep per user
   */
  async cleanupMemories(userId, maxMemories = 200) {
    try {
      const allMemories = await databaseManager.getUserMemories(userId, 1000);
      
      if (allMemories.length <= maxMemories) {
        return 0; // No cleanup needed
      }

      // Sort by importance and age, keep the most important and recent
      const toDelete = allMemories.slice(maxMemories);
      let deleteCount = 0;

      for (const memory of toDelete) {
        if (memory.importance < 7) { // Only delete less important memories
          await databaseManager.deleteMemory(userId, memory.memory_key);
          deleteCount++;
        }
      }

      logger.info(`Cleaned up ${deleteCount} old memories for user ${userId}`);
      return deleteCount;
    } catch (error) {
      logger.error('Error cleaning up memories:', error.message);
      return 0;
    }
  }
}

export default new MemoryManager();
