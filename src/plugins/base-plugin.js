/**
 * Base Plugin Class
 * All plugins should extend this class
 */
export default class BasePlugin {
  constructor() {
    this.name = 'BasePlugin';
    this.version = '1.0.0';
    this.description = 'Base plugin class';
    this.hooks = {};
  }

  /**
   * Initialize the plugin
   * Called when the plugin is loaded
   */
  async initialize() {
    // Override in subclasses
  }

  /**
   * Cleanup the plugin
   * Called when the plugin is unloaded
   */
  async cleanup() {
    // Override in subclasses
  }

  /**
   * Get plugin configuration
   */
  getConfig() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      hooks: Object.keys(this.hooks)
    };
  }

  /**
   * Log helper
   */
  log(level, message, ...args) {
    const prefix = `[${this.name}]`;
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
