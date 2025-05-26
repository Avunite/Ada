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
      const response = await this.client.get(`/notes/${noteId}`);
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
      const response = await this.client.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get user info:', error.message);
      throw error;
    }
  }

  async getMyInfo() {
    try {
      const response = await this.client.get('/i');
      return response.data;
    } catch (error) {
      logger.error('Failed to get my info:', error.message);
      throw error;
    }
  }
}

export default new BarkleClient();
