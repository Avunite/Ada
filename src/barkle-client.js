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

    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Barkle API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async sendMessage(text, replyTo = null, channelId = null) {
    try {
      const payload = {
        text: text
      };

      if (replyTo) {
        payload.replyId = replyTo;
      }

      if (channelId) {
        payload.channelId = channelId;
      }

      logger.debug('Sending message to Barkle:', payload);

      const response = await this.client.post('/notes', payload);
      logger.debug('Message sent successfully:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('Failed to send message:', error.message);
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
      const response = await this.client.post(`/channels/${groupId}/join`);
      logger.info(`Successfully joined group: ${groupId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to join group:', error.message);
      throw error;
    }
  }

  async leaveGroup(groupId) {
    try {
      const response = await this.client.post(`/channels/${groupId}/leave`);
      logger.info(`Successfully left group: ${groupId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to leave group:', error.message);
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
        visibility: 'specified',
        visibleUserIds: [userId]
      };

      logger.debug('Sending direct message:', payload);

      const response = await this.client.post('/notes', payload);
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
}

export default new BarkleClient();
