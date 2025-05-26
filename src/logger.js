import config from './config.js';

class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.levels[config.logLevel] || this.levels.info;
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (args.length > 0) {
      return `${prefix} ${message}`;
    }
    return `${prefix} ${message}`;
  }

  error(message, ...args) {
    if (this.currentLevel >= this.levels.error) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel >= this.levels.warn) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  info(message, ...args) {
    if (this.currentLevel >= this.levels.info) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  debug(message, ...args) {
    if (this.currentLevel >= this.levels.debug) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }
}

export default new Logger();
