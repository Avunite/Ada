import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Unblock User Tool
 * Unblocks a user on Barkle
 */
export default class UnblockTool extends BaseTool {
  constructor() {
    super();
    this.name = 'unblock';
    this.description = 'Unblock a user on Barkle';
    this.parameters = {
      userId: {
        type: 'string',
        description: 'User ID to unblock',
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
      this.debug(`Unblocking user: ${userId}`);

      const result = await barkleClient.unblockUser(userId);
      
      // Get user info for better response
      const userInfo = await barkleClient.getUserInfo(userId);
      
      this.info(`Successfully unblocked user: ${userInfo.username || userId}`);

      return {
        success: true,
        action: 'unblock',
        userId: userId,
        username: userInfo.username,
        displayName: userInfo.name || userInfo.username,
        message: `Successfully unblocked @${userInfo.username}`
      };

    } catch (error) {
      this.error('Unblock failed:', error.message);
      
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
          error: 'User is not blocked',
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
