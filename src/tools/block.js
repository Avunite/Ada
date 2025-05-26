import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Block User Tool
 * Blocks a user on Barkle
 */
export default class BlockTool extends BaseTool {
  constructor() {
    super();
    this.name = 'block';
    this.description = 'Block a user on Barkle';
    this.parameters = {
      userId: {
        type: 'string',
        description: 'User ID to block',
        required: false
      },
      username: {
        type: 'string',
        description: 'Username to block (without @ symbol) - will be converted to user ID automatically',
        required: false
      }
    };
  }

  async execute(params, context) {
    // Must provide either username or userId
    if (!params.username && !params.userId) {
      throw new Error('Must provide either username or userId');
    }

    // Resolve username to userId if needed
    const resolvedParams = await this.resolveUsername(params);
    
    const validation = this.validateParams(resolvedParams);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    const { userId } = resolvedParams;

    try {
      this.debug(`Blocking user: ${userId}`);

      const result = await barkleClient.blockUser(userId);
      
      // Get user info for better response
      const userInfo = await barkleClient.getUserInfo(userId);
      
      this.info(`Successfully blocked user: ${userInfo.username || userId}`);

      return {
        success: true,
        action: 'block',
        userId: userId,
        username: userInfo.username,
        displayName: userInfo.name || userInfo.username,
        message: `Successfully blocked @${userInfo.username}`
      };

    } catch (error) {
      this.error('Block failed:', error.message);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'User not found',
          userId: userId
        };
      } else if (error.response?.status === 409) {
        return {
          success: false,
          error: 'User is already blocked',
          userId: userId
        };
      }

      return {
        success: false,
        error: error.message,
        userId: userId
      };
    }
  }
}
