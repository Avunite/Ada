import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Send DM Tool
 * Sends a direct message to a user on Barkle
 */
export default class SendDMTool extends BaseTool {
  constructor() {
    super();
    this.name = 'dm';
    this.description = 'Send a direct message to a user on Barkle';
    this.parameters = {
      userId: {
        type: 'string',
        description: 'User ID to send DM to',
        required: true
      },
      message: {
        type: 'string',
        description: 'Message content to send',
        required: true
      }
    };
  }

  async execute(params, context) {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    const { userId, message } = params;

    try {
      this.debug(`Sending DM to user: ${userId}`);

      // Get user info first to validate and get details
      const userInfo = await barkleClient.getUserInfo(userId);
      
      // Send the DM
      const result = await barkleClient.sendDirectMessage(message, userId);
      
      this.info(`Successfully sent DM to: ${userInfo.username || userId}`);

      return {
        success: true,
        action: 'dm',
        userId: userId,
        username: userInfo.username,
        displayName: userInfo.name || userInfo.username,
        message: message,
        sentAt: new Date().toISOString(),
        noteId: result.id,
        response: `Successfully sent DM to @${userInfo.username}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
      };

    } catch (error) {
      this.error('DM send failed:', error.message);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'User not found',
          userId: userId,
          message: message
        };
      } else if (error.response?.status === 403) {
        return {
          success: false,
          error: 'Cannot send DM to this user (may be blocked or have DMs disabled)',
          userId: userId,
          message: message
        };
      }

      return {
        success: false,
        error: error.message,
        userId: userId,
        message: message
      };
    }
  }
}
