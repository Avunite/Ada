import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Follow User Tool
 * Follows a user on Barkle
 */
export default class FollowTool extends BaseTool {
  constructor() {
    super();
    this.name = 'follow';
    this.description = 'Follow a user on Barkle';
    this.parameters = {
      userId: {
        type: 'string',
        description: 'User ID to follow',
        required: false
      },
      username: {
        type: 'string',
        description: 'Username to follow (without @ symbol) - will be converted to user ID automatically',
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
      this.debug(`Following user: ${userId}`);

      const result = await barkleClient.followUser(userId);
      
      // Get user info for better response
      const userInfo = await barkleClient.getUserInfo(userId);
      
      this.info(`Successfully followed user: ${userInfo.username || userId}`);

      return {
        success: true,
        action: 'follow',
        userId: userId,
        username: userInfo.username,
        displayName: userInfo.name || userInfo.username,
        message: `Successfully followed @${userInfo.username}`
      };

    } catch (error) {
      this.error('Follow failed:', error.message);
      
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
          error: 'Already following this user',
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
