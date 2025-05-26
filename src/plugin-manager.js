import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginDir = path.join(__dirname, 'plugins');
    this.hooks = new Map();
  }

  async initialize() {
    logger.info('Initializing plugin system...');
    
    // Create plugins directory if it doesn't exist
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
      logger.info('Created plugins directory');
    }

    await this.loadPlugins();
  }

  async loadPlugins() {
    try {
      const pluginFiles = fs.readdirSync(this.pluginDir)
        .filter(file => file.endsWith('.js'))
        .filter(file => !file.startsWith('_')); // Skip files starting with underscore

      logger.info(`Found ${pluginFiles.length} plugin files`);

      for (const file of pluginFiles) {
        await this.loadPlugin(file);
      }
    } catch (error) {
      logger.error('Failed to load plugins:', error.message);
    }
  }

  async loadPlugin(filename) {
    try {
      const pluginPath = path.join(this.pluginDir, filename);
      const pluginModule = await import(`file://${pluginPath}`);
      
      if (!pluginModule.default) {
        logger.warn(`Plugin ${filename} does not export a default class`);
        return;
      }

      const PluginClass = pluginModule.default;
      const plugin = new PluginClass();

      // Validate plugin interface
      if (!this.validatePlugin(plugin)) {
        logger.warn(`Plugin ${filename} does not implement required interface`);
        return;
      }

      // Initialize the plugin
      await plugin.initialize();
      
      this.plugins.set(plugin.name, plugin);
      
      // Register plugin hooks
      if (plugin.hooks) {
        for (const [hookName, handler] of Object.entries(plugin.hooks)) {
          this.registerHook(hookName, handler, plugin.name);
        }
      }

      logger.info(`Loaded plugin: ${plugin.name} v${plugin.version}`);
    } catch (error) {
      logger.error(`Failed to load plugin ${filename}:`, error.message);
    }
  }

  validatePlugin(plugin) {
    const required = ['name', 'version', 'description'];
    
    for (const prop of required) {
      if (!plugin[prop]) {
        logger.warn(`Plugin missing required property: ${prop}`);
        return false;
      }
    }

    return true;
  }

  registerHook(hookName, handler, pluginName) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Map());
    }
    
    this.hooks.get(hookName).set(pluginName, handler);
    logger.debug(`Registered hook ${hookName} for plugin ${pluginName}`);
  }

  async executeHook(hookName, data, context = {}) {
    if (!this.hooks.has(hookName)) {
      return data;
    }

    const handlers = this.hooks.get(hookName);
    let result = data;

    for (const [pluginName, handler] of handlers) {
      try {
        logger.debug(`Executing hook ${hookName} for plugin ${pluginName}`);
        result = await handler(result, context);
      } catch (error) {
        logger.error(`Error in hook ${hookName} for plugin ${pluginName}:`, error.message);
      }
    }

    return result;
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      logger.warn(`Plugin ${name} not found`);
      return;
    }

    try {
      // Call cleanup if available
      if (plugin.cleanup) {
        await plugin.cleanup();
      }

      // Remove hooks
      for (const hookName of this.hooks.keys()) {
        this.hooks.get(hookName).delete(name);
      }

      this.plugins.delete(name);
      logger.info(`Unloaded plugin: ${name}`);
    } catch (error) {
      logger.error(`Failed to unload plugin ${name}:`, error.message);
    }
  }

  async reloadPlugin(name) {
    await this.unloadPlugin(name);
    // Note: Reloading would require tracking the original filename
    // This is a simplified implementation
    logger.info(`Plugin ${name} unloaded. Restart bot to reload.`);
  }
}

export default new PluginManager();
