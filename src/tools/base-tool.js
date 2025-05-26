/**
 * Base Tool Class
 * All agent tools should extend this class
 */
export default class BaseTool {
  constructor() {
    this.name = 'BaseTool';
    this.description = 'Base tool class';
    this.parameters = {};
  }

  /**
   * Execute the tool with given parameters
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context (user, note, etc.)
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(params = {}, context = {}) {
    throw new Error('execute method must be implemented by subclasses');
  }

  /**
   * Resolve username to user ID if needed
   * @param {Object} params - Parameters that may contain username
   * @returns {Promise<Object>} Parameters with userId resolved
   */
  async resolveUsername(params) {
    // Import here to avoid circular dependency
    const barkleClient = (await import('../barkle-client.js')).default;
    
    // If we have a username but no userId, try to resolve it
    if (params.username && !params.userId) {
      try {
        this.debug(`Resolving username to ID: ${params.username}`);
        const userInfo = await this.getUserByUsername(params.username, barkleClient);
        
        if (userInfo && userInfo.id) {
          // Create new params object with userId and keep original username
          const resolvedParams = { ...params, userId: userInfo.id };
          this.debug(`Resolved @${params.username} to user ID: ${userInfo.id}`);
          return resolvedParams;
        } else {
          throw new Error(`User not found: @${params.username}`);
        }
      } catch (error) {
        this.error(`Failed to resolve username @${params.username}:`, error.message);
        throw new Error(`Could not find user: @${params.username}`);
      }
    }
    
    return params;
  }

  /**
   * Look up user by username using search functionality
   * @param {string} username - Username to look up
   * @param {Object} barkleClient - Barkle client instance
   * @returns {Promise<Object|null>} User info or null if not found
   */
  async getUserByUsername(username, barkleClient) {
    try {
      // Remove @ symbol if present
      const cleanUsername = username.replace(/^@/, '');
      
      // Try searching for posts by this user to get their info
      const searchResults = await barkleClient.searchNotes({
        query: `from:${cleanUsername}`,
        limit: 1
      });

      if (searchResults && searchResults.length > 0 && searchResults[0].user) {
        const user = searchResults[0].user;
        if (user.username.toLowerCase() === cleanUsername.toLowerCase()) {
          return user;
        }
      }

      // If search doesn't work, try a more general search
      const generalSearch = await barkleClient.searchNotes({
        query: cleanUsername,
        limit: 10
      });

      // Look for exact username match in the results
      for (const note of generalSearch) {
        if (note.user && note.user.username.toLowerCase() === cleanUsername.toLowerCase()) {
          return note.user;
        }
      }

      return null;
    } catch (error) {
      this.debug('Username search failed:', error.message);
      return null;
    }
  }

  /**
   * Validate tool parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateParams(params) {
    const errors = [];
    
    for (const [key, config] of Object.entries(this.parameters)) {
      if (config.required && !(key in params)) {
        errors.push(`Missing required parameter: ${key}`);
      }
      
      if (key in params && config.type && typeof params[key] !== config.type) {
        errors.push(`Parameter ${key} must be of type ${config.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get tool schema for AI model
   */
  getSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(this.parameters).map(([key, config]) => [
            key,
            {
              type: config.type,
              description: config.description,
              ...(config.enum && { enum: config.enum })
            }
          ])
        ),
        required: Object.entries(this.parameters)
          .filter(([_, config]) => config.required)
          .map(([key, _]) => key)
      }
    };
  }

  /**
   * Log helper
   */
  log(level, message, ...args) {
    const prefix = `[Tool:${this.name}]`;
    console[level](`${prefix} ${message}`, ...args);
  }

  info(message, ...args) {
    this.log('log', message, ...args);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }
}
