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
        required: true
      }
    };
  }

  async execute(params, context) {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    const { userId } = params;

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
