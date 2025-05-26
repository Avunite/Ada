import logger from './logger.js';
import SearchBarksTool from './tools/search-barks.js';
import FollowTool from './tools/follow.js';
import UnfollowTool from './tools/unfollow.js';
import BlockTool from './tools/block.js';
import UnblockTool from './tools/unblock.js';
import DMTool from './tools/dm.js';

/**
 * Tool Manager
 * Manages agent tools and their execution
 */
class ToolManager {
  constructor() {
    this.tools = new Map();
    this.initialize();
  }

  initialize() {
    // Register all available tools
    this.registerTool(new SearchBarksTool());
    this.registerTool(new FollowTool());
    this.registerTool(new UnfollowTool());
    this.registerTool(new BlockTool());
    this.registerTool(new UnblockTool());
    this.registerTool(new DMTool());

    logger.info(`Initialized tool manager with ${this.tools.size} tools`);
  }

  registerTool(tool) {
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  getToolSchemas() {
    return this.getAllTools().map(tool => tool.getSchema());
  }

  async executeTool(name, params, context) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    logger.info(`Executing tool: ${name}`, { params, context: context.user?.username });

    try {
      const result = await tool.execute(params, context);
      logger.debug(`Tool ${name} executed successfully`);
      return {
        success: true,
        tool: name,
        result
      };
    } catch (error) {
      logger.error(`Tool ${name} execution failed:`, error.message);
      return {
        success: false,
        tool: name,
        error: error.message
      };
    }
  }

  async executeToolCalls(toolCalls, context) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          context
        );
        results.push({
          tool_call_id: toolCall.id,
          ...result
        });
      } catch (error) {
        logger.error(`Failed to execute tool call:`, error);
        results.push({
          tool_call_id: toolCall.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  formatToolResults(results) {
    return results.map(result => {
      if (result.success) {
        return `✅ ${result.tool}: ${JSON.stringify(result.result, null, 2)}`;
      } else {
        return `❌ ${result.tool}: ${result.error}`;
      }
    }).join('\n\n');
  }
}

export default new ToolManager();
