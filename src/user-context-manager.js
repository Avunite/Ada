import logger from './logger.js';
import barkleClient from './barkle-client.js';

/**
 * User Context Manager
 * Manages user profile caching and context retrieval
 */
class UserContextManager {
  constructor() {
    this.userCache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get user profile with caching
   */
  async getUserProfile(userId) {
    const cached = this.userCache.get(userId);
    
    // Return cached if still valid
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      logger.debug(`Using cached profile for user: ${userId}`);
      return cached.profile;
    }

    try {
      logger.debug(`Fetching fresh profile for user: ${userId}`);
      const profile = await barkleClient.getUserProfile(userId);
      
      // Cache the profile
      this.userCache.set(userId, {
        profile,
        timestamp: Date.now()
      });

      return profile;
    } catch (error) {
      logger.error(`Failed to fetch user profile for ${userId}:`, error.message);
      
      // Return cached data if available, even if expired
      if (cached) {
        logger.warn(`Using expired cache for user: ${userId}`);
        return cached.profile;
      }
      
      return null;
    }
  }

  /**
   * Get user context for AI processing
   */
  async getUserContext(userId) {
    const profile = await this.getUserProfile(userId);
    
    if (!profile) {
      return {
        username: 'unknown',
        displayName: 'Unknown User',
        context: 'No profile information available.'
      };
    }

    const contextParts = [
      `User: @${profile.username}`,
      profile.displayName && profile.displayName !== profile.username ? `Display Name: ${profile.displayName}` : null,
      profile.description ? `Bio: ${profile.description}` : null,
      profile.accountAgeFormatted ? `Account Age: ${profile.accountAgeFormatted}` : null,
      profile.birthday ? `Birthday: ${profile.birthday}` : null,
      profile.location ? `Location: ${profile.location}` : null,
      profile.website ? `Website: ${profile.website}` : null,
      `Posts: ${profile.notesCount}, Followers: ${profile.followersCount}, Following: ${profile.followingCount}`,
      profile.isBot ? 'This user is a bot.' : null,
      profile.isLocked ? 'This user has a private account.' : null,
      profile.isVerified ? 'This user is verified.' : null,
      profile.isStaff ? 'This user is an Avunite staff member.' : null,
      profile.id ? `User ID: ${profile.id}` : null,
    ].filter(Boolean);

    return {
      username: profile.username,
      displayName: profile.displayName,
      context: contextParts.join('\n'),
      profile
    };
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, cached] of this.userCache.entries()) {
      if ((now - cached.timestamp) > this.cacheTimeout) {
        this.userCache.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired user cache entries`);
    }
  }

  /**
   * Invalidate specific user cache
   */
  invalidateUser(userId) {
    this.userCache.delete(userId);
    logger.debug(`Invalidated cache for user: ${userId}`);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.userCache.clear();
    logger.debug('Cleared all user cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalEntries: this.userCache.size,
      entries: Array.from(this.userCache.entries()).map(([userId, cached]) => ({
        userId,
        age: Date.now() - cached.timestamp,
        username: cached.profile.username
      }))
    };
  }
}

export default new UserContextManager();
