import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Unfollow User Tool
 * Unfollows a user on Barkle
 */
export default class UnfollowTool extends BaseTool {
  constructor() {
    super();
    this.name = 'unfollow';
    this.description = 'Unfollow a user on Barkle';
    this.parameters = {
      userId: {
        type: 'string',
        description: 'User ID to unfollow',
        required: false
      },
      username: {
        type: 'string',
        description: 'Username to unfollow (without @ symbol) - will be converted to user ID automatically',
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
      this.debug(`Unfollowing user: ${userId}`);

      const result = await barkleClient.unfollowUser(userId);
      
      // Get user info for better response
      const userInfo = await barkleClient.getUserInfo(userId);
      
      this.info(`Successfully unfollowed user: ${userInfo.username || userId}`);

      return {
        success: true,
        action: 'unfollow',
        userId: userId,
        username: userInfo.username,
        displayName: userInfo.name || userInfo.username,
        message: `Successfully unfollowed @${userInfo.username}`
      };

    } catch (error) {
      this.error('Unfollow failed:', error.message);
      
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
          error: 'Not following this user',
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
