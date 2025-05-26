import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';
import logger from './logger.js';

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts;
    this.reconnectInterval = config.reconnectInterval;
    this.eventHandlers = new Map();
    this.subscriptions = new Set();
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn('WebSocket is already connected');
      return;
    }

    logger.info('Connecting to Barkle WebSocket...');

    this.ws = new WebSocket(config.barkleWssUrl, {
      headers: {
        'Authorization': `Bearer ${config.barkleApiKey}`
      }
    });

    this.ws.on('open', () => {
      logger.info('WebSocket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Connect to required channels
      this.connectToMainTimeline();
      this.connectToGlobalTimeline();
      this.connectToNotifications();
      this.connectToMentions();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.warn(`WebSocket closed: ${code} - ${reason}`);
      this.isConnected = false;
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error:', error.message);
      this.isConnected = false;
    });
  }

  handleMessage(message) {
    // Only log important message types to reduce noise
    if (message.type === 'notification' || message.type === 'noteUpdated') {
      logger.debug('Received WebSocket message:', message.type);
    }

    // Handle different message types
    switch (message.type) {
      case 'channel':
        if (message.body) {
          this.handleChannelMessage(message.body);
        }
        break;
      case 'noteUpdated':
        this.handleNoteUpdate(message.body);
        break;
      case 'notification':
        this.handleNotification(message.body);
        break;
      default:
        logger.debug('Unhandled message type:', message.type);
    }
  }

  handleChannelMessage(body) {
    // This handles timeline messages
    if (body.type === 'note') {
      this.emit('note', body.body);
    }
  }

  handleNoteUpdate(note) {
    this.emit('noteUpdate', note);
  }

  handleNotification(notification) {
    logger.info('Received notification:', notification.type);

    // Handle specific notification types
    switch (notification.type) {
      case 'mention':
        this.emit('mention', notification);
        break;
      case 'reply':
        this.emit('reply', notification);
        break;
      case 'groupInvited':
        this.emit('groupInvite', notification);
        break;
      default:
        // Only emit general notification for unhandled types
        logger.debug('Unhandled notification type:', notification.type);
        this.emit('notification', notification);
    }
  }

  connectToMainTimeline() {
    this.send({
      type: 'connect',
      body: {
        channel: 'homeTimeline',
        id: uuidv4()
      }
    });
    logger.debug('Connected to home timeline');
  }

  connectToGlobalTimeline() {
    this.send({
      type: 'connect',
      body: {
        channel: 'globalTimeline',
        id: uuidv4()
      }
    });
    logger.debug('Connected to global timeline');
  }

  connectToNotifications() {
    this.send({
      type: 'connect',
      body: {
        channel: 'main',
        id: uuidv4()
      }
    });
    logger.debug('Connected to main notifications');
  }

  connectToMentions() {
    this.send({
      type: 'connect',
      body: {
        channel: 'mentions',
        id: uuidv4()
      }
    });
    logger.debug('Connected to mentions channel');
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      logger.warn('Cannot send message: WebSocket not connected');
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Error in event handler for ${event}:`, error.message);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

export default new WebSocketManager();
