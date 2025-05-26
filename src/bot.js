import config from './config.js';
import logger from './logger.js';
import websocketManager from './websocket-manager.js';
import messageHandler from './message-handler.js';
import pluginManager from './plugin-manager.js';

class AdaBot {
  constructor() {
    this.isRunning = false;
    this.startTime = null;
  }

  async start() {
    try {
      logger.info(`Starting ${config.botName}...`);
      this.startTime = new Date();

      // Validate configuration
      this.validateConfig();

      // Initialize plugin system
      await pluginManager.initialize();

      // Initialize message handler
      await messageHandler.initialize();

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to WebSocket
      websocketManager.connect();

      this.isRunning = true;
      logger.info(`${config.botName} started successfully!`);

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start bot:', error.message);
      process.exit(1);
    }
  }

  validateConfig() {
    logger.info('Validating configuration...');
    
    // Config validation is handled in config.js constructor
    logger.info('Configuration validated successfully');
  }

  setupEventHandlers() {
    logger.info('Setting up event handlers...');

    // Handle incoming notes (messages)
    websocketManager.on('note', async (note) => {
      try {
        // Execute before process hooks
        const processData = await pluginManager.executeHook('beforeProcess', {
          note,
          timestamp: Date.now()
        });

        // Check if processing was blocked by plugins
        if (processData.blocked) {
          logger.debug(`Message processing blocked: ${processData.reason}`);
          return;
        }

        await messageHandler.handleNote(note);

        // Execute after process hooks
        await pluginManager.executeHook('afterProcess', {
          note,
          processed: true,
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('Error handling note:', error.message);
      }
    });

    // Handle mentions
    websocketManager.on('mention', async (notification) => {
      try {
        await messageHandler.handleMention(notification);
      } catch (error) {
        logger.error('Error handling mention:', error.message);
      }
    });

    // Handle replies
    websocketManager.on('reply', async (notification) => {
      try {
        await messageHandler.handleReply(notification);
      } catch (error) {
        logger.error('Error handling reply:', error.message);
      }
    });

    // Handle group invitations
    websocketManager.on('groupInvite', async (notification) => {
      try {
        await messageHandler.handleGroupInvite(notification);
      } catch (error) {
        logger.error('Error handling group invite:', error.message);
      }
    });

    // Handle general notifications
    websocketManager.on('notification', async (notification) => {
      try {
        await pluginManager.executeHook('onNotification', {
          notification,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Error handling notification:', error.message);
      }
    });

    logger.info('Event handlers set up successfully');
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping bot...');

    try {
      // Disconnect WebSocket
      websocketManager.disconnect();

      // Cleanup plugins
      const plugins = pluginManager.getAllPlugins();
      for (const plugin of plugins) {
        if (plugin.cleanup) {
          await plugin.cleanup();
        }
      }

      this.isRunning = false;
      logger.info('Bot stopped successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error.message);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      botName: config.botName,
      botUsername: config.botUsername,
      wsConnected: websocketManager.isConnected,
      pluginCount: pluginManager.getAllPlugins().length
    };
  }

  async reloadConfig() {
    try {
      config.reloadSystemPrompt();
      logger.info('Configuration reloaded');
    } catch (error) {
      logger.error('Failed to reload configuration:', error.message);
    }
  }

  async executeCommand(command, args = []) {
    switch (command) {
      case 'status':
        return this.getStatus();
      
      case 'reload':
        await this.reloadConfig();
        return { success: true, message: 'Configuration reloaded' };
      
      case 'plugins':
        return {
          plugins: pluginManager.getAllPlugins().map(p => p.getConfig())
        };
      
      case 'stop':
        await this.stop();
        return { success: true, message: 'Bot stopped' };
      
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}

export default AdaBot;
