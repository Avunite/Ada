import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Lookup User Tool
 * Looks up user information by username or user ID
 */
export default class LookupUserTool extends BaseTool {
  constructor() {
    super();
    this.name = 'lookup_user';
    this.description = 'Look up user information by username or user ID';
    this.parameters = {
      username: {
        type: 'string',
        description: 'Username to look up (without @ symbol)',
        required: false
      },
      userId: {
        type: 'string',
        description: 'User ID to look up',
        required: false
      }
    };
  }

  async execute(params, context) {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    const { username, userId } = params;

    // Must provide either username or userId
    if (!username && !userId) {
      throw new Error('Must provide either username or userId');
    }

    try {
      let userInfo;
      let lookupMethod;

      if (userId) {
        // Direct lookup by user ID
        this.debug(`Looking up user by ID: ${userId}`);
        userInfo = await barkleClient.getUserInfo(userId);
        lookupMethod = 'userId';
      } else {
        // Lookup by username using search
        this.debug(`Looking up user by username: ${username}`);
        userInfo = await this.getUserByUsername(username);
        lookupMethod = 'username';
      }

      if (!userInfo) {
        return {
          success: false,
          error: 'User not found',
          searchTerm: username || userId,
          method: lookupMethod
        };
      }

      this.info(`Successfully found user: ${userInfo.username || userInfo.id}`);

      return {
        success: true,
        user: {
          id: userInfo.id,
          username: userInfo.username,
          displayName: userInfo.name || userInfo.username,
          description: userInfo.description,
          avatarUrl: userInfo.avatarUrl,
          followersCount: userInfo.followersCount || 0,
          followingCount: userInfo.followingCount || 0,
          notesCount: userInfo.notesCount || 0,
          isBot: userInfo.isBot || false,
          isLocked: userInfo.isLocked || false,
          isVerified: userInfo.isVerified || false,
          createdAt: userInfo.createdAt
        },
        method: lookupMethod
      };

    } catch (error) {
      this.error('User lookup failed:', error.message);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'User not found',
          searchTerm: username || userId,
          method: lookupMethod
        };
      }

      return {
        success: false,
        error: error.message,
        searchTerm: username || userId,
        method: lookupMethod
      };
    }
  }

  /**
   * Look up user by username using search functionality
   * This is a workaround since there might not be a direct username lookup endpoint
   */
  async getUserByUsername(username) {
    try {
      // Try searching for posts by this user to get their info
      const searchResults = await barkleClient.searchNotes({
        query: `from:${username}`,
        limit: 1
      });

      if (searchResults && searchResults.length > 0 && searchResults[0].user) {
        const user = searchResults[0].user;
        if (user.username.toLowerCase() === username.toLowerCase()) {
          return user;
        }
      }

      // If search doesn't work, try a more general search
      const generalSearch = await barkleClient.searchNotes({
        query: username,
        limit: 10
      });

      // Look for exact username match in the results
      for (const note of generalSearch) {
        if (note.user && note.user.username.toLowerCase() === username.toLowerCase()) {
          return note.user;
        }
      }

      return null;
    } catch (error) {
      this.debug('Username search failed, user might not exist:', error.message);
      return null;
    }
  }
}
