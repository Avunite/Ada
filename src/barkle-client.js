import axios from 'axios';
import config from './config.js';
import logger from './logger.js';

class BarkleClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.barkleApiUrl,
      headers: {
        'Authorization': `Bearer ${config.barkleApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    this.client.interceptors.request.use(
      config => {
        logger.debug(`🔵 API REQUEST: ${config.method?.toUpperCase()} ${config.url}`);
        logger.debug(`🔵 Headers:`, config.headers);
        logger.debug(`🔵 Data:`, config.data);
        return config;
      },
      error => {
        logger.error('🔴 Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      response => {
        logger.debug(`🟢 API RESPONSE: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        logger.debug(`🟢 Response data:`, response.data);
        return response;
      },
      error => {
        logger.error(`🔴 API ERROR: ${error.response?.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
        logger.error('🔴 Error response:', error.response?.data);
        logger.error('🔴 Error message:', error.message);
        throw error;
      }
    );
  }

  async sendMessage(text, options = {}) {
    try {
      const payload = {
        text: text
      };

      // Handle options object
      if (options.replyTo) {
        payload.replyId = options.replyTo;
      }

      if (options.channelId) {
        payload.channelId = options.channelId;
      }

      if (options.visibility) {
        payload.visibility = options.visibility;
      }

      if (options.visibleUserIds) {
        payload.visibleUserIds = options.visibleUserIds;
      }

      logger.info('📤 SENDING MESSAGE:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        options,
        fullPayload: payload
      });

      const response = await this.client.post('/notes/create', payload);
      
      logger.info('✅ MESSAGE SENT SUCCESSFULLY:', {
        noteId: response.data?.createdNote?.id,
        status: response.status,
        responseData: response.data
      });
      
      return response.data.createdNote;
    } catch (error) {
      logger.error('❌ FAILED TO SEND MESSAGE:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        originalPayload: { text, options }
      });
      throw error;
    }
  }

  async getNote(noteId) {
    try {
      const response = await this.client.post(`/notes/show`, { noteId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get note:', error.message);
      throw error;
    }
  }

  async getConversationThread(noteId, maxDepth = 10) {
    try {
      const thread = [];
      let currentNote = await this.getNote(noteId);
      
      // Get the conversation chain by following replies
      let depth = 0;
      while (currentNote && depth < maxDepth) {
        thread.unshift({
          id: currentNote.id,
          text: currentNote.text,
          user: currentNote.user,
          createdAt: currentNote.createdAt
        });

        if (currentNote.replyId) {
          currentNote = await this.getNote(currentNote.replyId);
          depth++;
        } else {
          break;
        }
      }

      return thread;
    } catch (error) {
      logger.error('Failed to get conversation thread:', error.message);
      return [];
    }
  }

  async joinGroup(groupId) {
    try {
      const response = await this.client.post('/messaging/groups/join', { groupId });
      logger.info(`Successfully joined DM group: ${groupId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to join DM group:', error.message);
      throw error;
    }
  }

  async leaveGroup(groupId) {
    try {
      const response = await this.client.post('/messaging/groups/leave', { groupId });
      logger.info(`Successfully left DM group: ${groupId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to leave DM group:', error.message);
      throw error;
    }
  }

  async getUserInfo(userId) {
    try {
      const response = await this.client.post(`/users/show`, { userId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get user info:', error.message);
      throw error;
    }
  }

  async getMyInfo() {
    try {
      // Try different possible endpoints for getting user info
      const endpoints = ['/i', '/users/me', '/me', '/auth/session'];
      
      for (const endpoint of endpoints) {
        try {
          const response = await this.client.post(endpoint);
          logger.debug(`Successfully got user info from: ${endpoint}`);
          return response.data;
        } catch (error) {
          logger.debug(`Failed to get user info from ${endpoint}: ${error.response?.status}`);
          continue;
        }
      }
      
      throw new Error('No valid endpoint found for getting user info');
    } catch (error) {
      logger.error('Failed to get my info:', error.message);
      throw error;
    }
  }

  async searchNotes(params) {
    try {
      const response = await this.client.post('/notes/search', params);
      return response.data;
    } catch (error) {
      logger.error('Failed to search notes:', error.message);
      throw error;
    }
  }

  async followUser(userId) {
    try {
      const response = await this.client.post('/following/create', { userId });
      logger.info(`Successfully followed user: ${userId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to follow user:', error.message);
      throw error;
    }
  }

  async unfollowUser(userId) {
    try {
      const response = await this.client.post('/following/delete', { userId });
      logger.info(`Successfully unfollowed user: ${userId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to unfollow user:', error.message);
      throw error;
    }
  }

  async blockUser(userId) {
    try {
      const response = await this.client.post('/blocking/create', { userId });
      logger.info(`Successfully blocked user: ${userId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to block user:', error.message);
      throw error;
    }
  }

  async unblockUser(userId) {
    try {
      const response = await this.client.post('/blocking/delete', { userId });
      logger.info(`Successfully unblocked user: ${userId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to unblock user:', error.message);
      throw error;
    }
  }

  async sendDirectMessage(text, userId) {
    try {
      const payload = {
        text: text,
        userId: userId
      };

      logger.debug('Sending direct message:', payload);

      const response = await this.client.post('/messaging/messages/create', payload);
      logger.debug('Direct message sent successfully:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('Failed to send direct message:', error.message);
      throw error;
    }
  }

  async getUserProfile(userId) {
    try {
      const response = await this.client.post(`/users/show`, { userId });
      const user = response.data;
      
      // Calculate account age
      const accountAge = user.createdAt ? 
        Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : null;

      return {
        id: user.id,
        username: user.username,
        displayName: user.name || user.username,
        description: user.description || null,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        accountAge: accountAge,
        accountAgeFormatted: accountAge ? `${accountAge} days` : null,
        birthday: user.birthday || null,
        location: user.location || null,
        website: user.url || null,
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        notesCount: user.notesCount || 0,
        isBot: user.isBot || false,
        isLocked: user.isLocked || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        fields: user.fields || []
      };
    } catch (error) {
      logger.error('Failed to get user profile:', error.message);
      throw error;
    }
  }

  async getMessagingHistory(limit = 20) {
    try {
      const response = await this.client.post('/messaging/history', { limit });
      return response.data;
    } catch (error) {
      logger.error('Failed to get messaging history:', error.message);
      throw error;
    }
  }

  async getMessagesForUser(userId, limit = 1) {
    try {
      const response = await this.client.post('/messaging/messages', {
        userId: userId,
        limit: limit
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get messages for user:', error.message);
      throw error;
    }
  }

  async updateNotificationSettings() {
    try {
      // Unmute important notifications (keep follow requests and app notifications muted)
      const payload = {
        mutingNotificationTypes: ['follow', 'pollVote', 'pollEnded', 'receiveFollowRequest', 'followRequestAccepted', 'groupInvited', 'app']
      };

      logger.info('📱 UPDATING NOTIFICATION SETTINGS to unmute mentions and replies');

      const response = await this.client.post('/i/update', payload);
      
      logger.info('✅ NOTIFICATION SETTINGS UPDATED:', {
        status: response.status,
        newMutingTypes: payload.mutingNotificationTypes
      });
      
      return response.data;
    } catch (error) {
      logger.error('❌ FAILED TO UPDATE NOTIFICATION SETTINGS:', {
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      });
      throw error;
    }
  }

  async markNotificationAsRead(notificationId) {
    try {
      logger.debug(`📖 Marking notification as read: ${notificationId}`);

      // Try multiple possible endpoints for marking notifications as read
      const endpoints = [
        { endpoint: '/i/read-notification', payload: { notificationId } },
        { endpoint: '/notifications/read', payload: { id: notificationId } },
        { endpoint: '/i/read-all-notifications', payload: {} }
      ];

      for (const { endpoint, payload } of endpoints) {
        try {
          const response = await this.client.post(endpoint, payload);
          logger.info(`✅ Successfully marked notification as read via ${endpoint}`);
          return response.data;
        } catch (error) {
          logger.debug(`Failed to mark as read via ${endpoint}: ${error.response?.status}`);
          continue;
        }
      }
      
      // If all specific endpoints fail, log but don't throw error
      logger.warn(`Could not mark notification ${notificationId} as read - no working endpoint found`);
      return null;

    } catch (error) {
      logger.error('❌ FAILED TO MARK NOTIFICATION AS READ:', {
        notificationId,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data
      });
      // Don't throw error as this is not critical to bot functionality
      return null;
    }
  }
}

export default new BarkleClient();
