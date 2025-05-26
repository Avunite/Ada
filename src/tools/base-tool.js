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
