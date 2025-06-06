import sqlite3 from 'sqlite3';
import logger from './logger.js';

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initialize();
  }

  initialize() {
    this.db = new sqlite3.Database('chat_history.db', (err) => {
      if (err) {
        logger.error('Error opening database:', err.message);
      } else {
        logger.info('Connected to SQLite database');
      }
    });

    // Create messages table if it doesn't exist
    this.db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      role TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        logger.error('Error creating messages table:', err.message);
      } else {
        logger.debug('Messages table ready');
      }
    });

    // Create limits table to track user message counts
    this.db.run(`CREATE TABLE IF NOT EXISTS message_limits (
      userId TEXT PRIMARY KEY,
      message_count INTEGER DEFAULT 0,
      reset_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        logger.error('Error creating message_limits table:', err.message);
      } else {
        logger.debug('Message limits table ready');
      }
    });

    // Create processed notifications table to prevent duplicate processing
    this.db.run(`CREATE TABLE IF NOT EXISTS processed_notifications (
      id TEXT PRIMARY KEY,
      notification_id TEXT UNIQUE,
      notification_type TEXT,
      user_id TEXT,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        logger.error('Error creating processed_notifications table:', err.message);
      } else {
        logger.debug('Processed notifications table ready');
      }
    });

    // Create user memories table for persistent per-user memory
    this.db.run(`CREATE TABLE IF NOT EXISTS user_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      memory_type TEXT,
      memory_key TEXT,
      memory_value TEXT,
      importance INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, memory_key)
    )`, (err) => {
      if (err) {
        logger.error('Error creating user_memories table:', err.message);
      } else {
        logger.debug('User memories table ready');
      }
    });
  }

  async fetchMessagesFromDB(userId) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT role, content FROM messages WHERE userId = ? ORDER BY id ASC', userId, (err, rows) => {
        if (err) {
          logger.error('Error fetching messages from DB:', err.message);
          reject(err);
        } else {
          logger.debug(`Fetched ${rows.length} messages for user ${userId}`);
          resolve(rows);
        }
      });
    });
  }

  async storeMessages(userId, messages) {
    const stmt = this.db.prepare('INSERT INTO messages (userId, role, content) VALUES (?, ?, ?)');
    
    for (const message of messages) {
      await new Promise((resolve, reject) => {
        const content = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);
          
        stmt.run(userId, message.role, content, (err) => {
          if (err) {
            logger.error('Error storing message:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    stmt.finalize();
    logger.debug(`Stored ${messages.length} messages for user ${userId}`);
  }

  async clearContext(userId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM messages WHERE userId = ?', userId, (err) => {
        if (err) {
          logger.error('Error clearing context:', err.message);
          reject(err);
        } else {
          logger.info(`Cleared conversation context for user ${userId}`);
          resolve();
        }
      });
    });
  }

  async checkMessageLimit(userId, isPlus = false) {
    if (isPlus) {
      logger.debug(`User ${userId} has Plus, unlimited messages`);
      return true; // Unlimited messages for Plus users
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    
    const row = await new Promise((resolve, reject) => {
      this.db.get('SELECT message_count, reset_time FROM message_limits WHERE userId = ?', userId, (err, row) => {
        if (err) {
          logger.error('Error fetching message limit:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (row) {
      const resetTime = new Date(row.reset_time);
      if (resetTime < oneHourAgo) {
        // Reset the count
        this.db.run('UPDATE message_limits SET message_count = 1, reset_time = ? WHERE userId = ?', [now, userId]);
        logger.debug(`Reset message count for user ${userId}`);
        return true;
      } else if (row.message_count < 15) {
        // Increment the count
        this.db.run('UPDATE message_limits SET message_count = message_count + 1 WHERE userId = ?', userId);
        logger.debug(`Incremented message count for user ${userId} to ${row.message_count + 1}`);
        return true;
      } else {
        // Limit reached
        const resetTime = new Date(row.reset_time);
        const utcResetTime = resetTime.toISOString();
        logger.info(`Message limit reached for user ${userId}, reset at ${utcResetTime}`);
        return { 
          limitReached: true, 
          resetTime: utcResetTime 
        };
      }
    } else {
      // New user, initialize limit
      this.db.run('INSERT INTO message_limits (userId, message_count, reset_time) VALUES (?, 1, ?)', [userId, now]);
      logger.debug(`Initialized message limit for new user ${userId}`);
      return true;
    }
  }

  async getConversationHistory(userId, systemPrompt = '') {
    try {
      let messagesFromDB = await this.fetchMessagesFromDB(userId);
      
      // If there are no messages and we have a system prompt, add it as the first user message
      if (messagesFromDB.length === 0 && systemPrompt) {
        await this.storeMessages(userId, [{ role: 'user', content: systemPrompt }]);
        messagesFromDB = await this.fetchMessagesFromDB(userId);
      }

      // Transform messages for AI consumption
      return messagesFromDB.map(message => ({
        role: message.role,
        content: message.content
      }));
    } catch (error) {
      logger.error('Error getting conversation history:', error.message);
      return [];
    }
  }

  async isNotificationProcessed(notificationId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT notification_id FROM processed_notifications WHERE notification_id = ?', 
        notificationId, (err, row) => {
        if (err) {
          logger.error('Error checking notification processing status:', err.message);
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  async markNotificationAsProcessed(notificationId, notificationType, userId) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT OR IGNORE INTO processed_notifications (notification_id, notification_type, user_id) VALUES (?, ?, ?)', 
        [notificationId, notificationType, userId], (err) => {
        if (err) {
          logger.error('Error marking notification as processed:', err.message);
          reject(err);
        } else {
          logger.debug(`Marked notification ${notificationId} as processed`);
          resolve();
        }
      });
    });
  }

  async cleanupOldNotifications(daysOld = 7) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000)).toISOString();
      this.db.run('DELETE FROM processed_notifications WHERE processed_at < ?', 
        cutoffDate, function(err) {
        if (err) {
          logger.error('Error cleaning up old notifications:', err.message);
          reject(err);
        } else {
          logger.info(`Cleaned up ${this.changes} old notification records`);
          resolve(this.changes);
        }
      });
    });
  }

  // Memory Management Methods

  /**
   * Store a memory for a user
   * @param {string} userId - The user ID
   * @param {string} memoryKey - A unique key for this memory
   * @param {string} memoryValue - The memory content
   * @param {string} memoryType - Type of memory (preference, fact, conversation, etc.)
   * @param {number} importance - Importance level (1-10, higher is more important)
   */
  async storeMemory(userId, memoryKey, memoryValue, memoryType = 'general', importance = 1) {
    return new Promise((resolve, reject) => {
      this.db.run(`INSERT OR REPLACE INTO user_memories 
        (user_id, memory_key, memory_value, memory_type, importance, updated_at) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, 
        [userId, memoryKey, memoryValue, memoryType, importance], (err) => {
        if (err) {
          logger.error('Error storing memory:', err.message);
          reject(err);
        } else {
          logger.debug(`Stored memory for user ${userId}: ${memoryKey} = ${memoryValue}`);
          resolve();
        }
      });
    });
  }

  /**
   * Retrieve a specific memory for a user
   * @param {string} userId - The user ID
   * @param {string} memoryKey - The memory key to retrieve
   */
  async getMemory(userId, memoryKey) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM user_memories WHERE user_id = ? AND memory_key = ?', 
        [userId, memoryKey], (err, row) => {
        if (err) {
          logger.error('Error retrieving memory:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all memories for a user, ordered by importance and recency
   * @param {string} userId - The user ID
   * @param {number} limit - Maximum number of memories to return
   */
  async getUserMemories(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM user_memories 
        WHERE user_id = ? 
        ORDER BY importance DESC, updated_at DESC 
        LIMIT ?`, 
        [userId, limit], (err, rows) => {
        if (err) {
          logger.error('Error retrieving user memories:', err.message);
          reject(err);
        } else {
          logger.debug(`Retrieved ${rows.length} memories for user ${userId}`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Search memories for a user by content
   * @param {string} userId - The user ID
   * @param {string} searchTerm - Term to search for in memory values
   * @param {number} limit - Maximum number of results
   */
  async searchMemories(userId, searchTerm, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM user_memories 
        WHERE user_id = ? AND memory_value LIKE ? 
        ORDER BY importance DESC, updated_at DESC 
        LIMIT ?`, 
        [userId, `%${searchTerm}%`, limit], (err, rows) => {
        if (err) {
          logger.error('Error searching memories:', err.message);
          reject(err);
        } else {
          logger.debug(`Found ${rows.length} memories for user ${userId} matching "${searchTerm}"`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Delete a specific memory
   * @param {string} userId - The user ID
   * @param {string} memoryKey - The memory key to delete
   */
  async deleteMemory(userId, memoryKey) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM user_memories WHERE user_id = ? AND memory_key = ?', 
        [userId, memoryKey], function(err) {
        if (err) {
          logger.error('Error deleting memory:', err.message);
          reject(err);
        } else {
          logger.debug(`Deleted memory for user ${userId}: ${memoryKey}`);
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Clear all memories for a user
   * @param {string} userId - The user ID
   */
  async clearUserMemories(userId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM user_memories WHERE user_id = ?', userId, function(err) {
        if (err) {
          logger.error('Error clearing user memories:', err.message);
          reject(err);
        } else {
          logger.info(`Cleared ${this.changes} memories for user ${userId}`);
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Update memory importance
   * @param {string} userId - The user ID
   * @param {string} memoryKey - The memory key
   * @param {number} importance - New importance level
   */
  async updateMemoryImportance(userId, memoryKey, importance) {
    return new Promise((resolve, reject) => {
      this.db.run(`UPDATE user_memories 
        SET importance = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND memory_key = ?`, 
        [importance, userId, memoryKey], function(err) {
        if (err) {
          logger.error('Error updating memory importance:', err.message);
          reject(err);
        } else {
          logger.debug(`Updated memory importance for user ${userId}: ${memoryKey} = ${importance}`);
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Get memory statistics for a user
   * @param {string} userId - The user ID
   */
  async getMemoryStats(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT 
        COUNT(*) as total_memories,
        COUNT(DISTINCT memory_type) as memory_types,
        AVG(importance) as avg_importance,
        MAX(updated_at) as last_updated
        FROM user_memories WHERE user_id = ?`, 
        [userId], (err, row) => {
        if (err) {
          logger.error('Error getting memory stats:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err.message);
        } else {
          logger.info('Database connection closed');
        }
      });
    }
  }
}

export default new DatabaseManager();
