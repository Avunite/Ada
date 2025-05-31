import BaseTool from './base-tool.js';
import memoryManager from '../memory-manager.js';
import logger from '../logger.js';

/**
 * Memory Tool
 * Allows the AI to store and retrieve user memories
 */
export default class MemoryTool extends BaseTool {
  constructor() {
    super();
    this.name = 'memory';
    this.description = 'Store or retrieve user memories. Use this to remember important information about users or recall what you know about them.';
    this.parameters = {
      action: {
        type: 'string',
        description: 'Action to perform: "store", "retrieve", or "search"',
        required: true,
        enum: ['store', 'retrieve', 'search']
      },
      memoryKey: {
        type: 'string',
        description: 'Unique key for the memory (required for store/retrieve)',
        required: false
      },
      memoryValue: {
        type: 'string',
        description: 'Memory content to store (required for store action)',
        required: false
      },
      memoryType: {
        type: 'string',
        description: 'Type of memory: preference, fact, conversation, relationship, interest, goal, experience, reminder',
        required: false,
        enum: ['preference', 'fact', 'conversation', 'relationship', 'interest', 'goal', 'experience', 'reminder']
      },
      importance: {
        type: 'number',
        description: 'Importance level 1-10 (higher is more important, default 5)',
        required: false,
        minimum: 1,
        maximum: 10
      },
      searchQuery: {
        type: 'string',
        description: 'Search term for finding memories (required for search action)',
        required: false
      },
      limit: {
        type: 'number',
        description: 'Maximum number of memories to return (default 5)',
        required: false,
        minimum: 1,
        maximum: 20
      }
    };
  }

  async execute(params, context) {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    const { action, memoryKey, memoryValue, memoryType = 'fact', importance = 5, searchQuery, limit = 5 } = params;
    const userId = context?.note?.userId;

    if (!userId) {
      throw new Error('User ID not available in context');
    }

    try {
      switch (action) {
        case 'store':
          if (!memoryKey || !memoryValue) {
            throw new Error('memoryKey and memoryValue are required for store action');
          }

          await memoryManager.storeSpecificMemory(userId, memoryKey, memoryValue, memoryType, importance);
          
          this.info(`Stored memory for user ${userId}: ${memoryKey}`);
          return {
            success: true,
            action: 'store',
            memoryKey,
            memoryValue,
            memoryType,
            importance,
            message: `Successfully stored memory: "${memoryValue}"`
          };

        case 'retrieve':
          if (!memoryKey) {
            throw new Error('memoryKey is required for retrieve action');
          }

          const memory = await memoryManager.searchRelatedMemories(userId, memoryKey, 1);
          
          if (memory.length > 0) {
            this.info(`Retrieved memory for user ${userId}: ${memoryKey}`);
            return {
              success: true,
              action: 'retrieve',
              memoryKey,
              memory: memory[0],
              message: `Found memory: "${memory[0].memory_value}"`
            };
          } else {
            return {
              success: false,
              action: 'retrieve',
              memoryKey,
              message: `No memory found for key: "${memoryKey}"`
            };
          }

        case 'search':
          if (!searchQuery) {
            throw new Error('searchQuery is required for search action');
          }

          const memories = await memoryManager.searchRelatedMemories(userId, searchQuery, limit);
          
          this.info(`Searched memories for user ${userId}: "${searchQuery}" - found ${memories.length}`);
          return {
            success: true,
            action: 'search',
            searchQuery,
            memoriesFound: memories.length,
            memories: memories.map(m => ({
              key: m.memory_key,
              value: m.memory_value,
              type: m.memory_type,
              importance: m.importance,
              created: m.created_at,
              updated: m.updated_at
            })),
            message: `Found ${memories.length} memories matching "${searchQuery}"`
          };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.error('Memory operation failed:', error.message);
      return {
        success: false,
        action,
        error: error.message,
        message: `Memory operation failed: ${error.message}`
      };
    }
  }

  validateParams(params) {
    const errors = [];
    
    if (!params.action) {
      errors.push('action is required');
    } else if (!['store', 'retrieve', 'search'].includes(params.action)) {
      errors.push('action must be "store", "retrieve", or "search"');
    }

    if (params.action === 'store') {
      if (!params.memoryKey) errors.push('memoryKey is required for store action');
      if (!params.memoryValue) errors.push('memoryValue is required for store action');
      if (params.importance && (params.importance < 1 || params.importance > 10)) {
        errors.push('importance must be between 1 and 10');
      }
    }

    if (params.action === 'retrieve' && !params.memoryKey) {
      errors.push('memoryKey is required for retrieve action');
    }

    if (params.action === 'search' && !params.searchQuery) {
      errors.push('searchQuery is required for search action');
    }

    if (params.limit && (params.limit < 1 || params.limit > 20)) {
      errors.push('limit must be between 1 and 20');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
