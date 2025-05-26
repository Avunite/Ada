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
    this.botUsername = config.botUsername || 'Ada'; // Store the bot username
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
      // Main timeline needed for mentions to work properly
      this.connectToMainTimeline();
      this.connectToNotifications();
      this.connectToMessaging();
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

  // Check if the bot is mentioned in a case-insensitive way
  isBotMentioned(content) {
    if (!content) return false;
    
    // Create a case-insensitive regex for @username
    const mentionRegex = new RegExp(`@${this.botUsername}\\b`, 'i');
    return mentionRegex.test(content);
  }

  handleMessage(message) {
    // Log all message types to debug mention issues
    logger.debug('📨 Received WebSocket message:', message.type, message.body?.type || 'no body type');
    
    // Check for mentions in a case-insensitive way if there's content to check
    if (message.body && message.body.body && message.body.body.text) {
      const messageText = message.body.body.text;
      if (this.isBotMentioned(messageText)) {
        logger.info(`🎯 Case-insensitive mention detected in message: "${messageText}"`);
      }
    }
    
    // Handle different message types
    switch (message.type) {
      case 'channel':
        if (message.body) {
          // Check for notification messages according to docs
          if (message.body.type === 'notification') {
            logger.info('🔔 NOTIFICATION MESSAGE RECEIVED via channel:', JSON.stringify(message.body, null, 2));
            const notification = message.body.body;
            if (notification && notification.type === 'mention') {
              logger.info('🎯 MENTION NOTIFICATION FOUND! Processing...');
              this.emit('mention', notification);
            } else if (notification && notification.type === 'reply') {
              logger.info('💬 REPLY NOTIFICATION FOUND! Processing...');
              this.emit('reply', notification);
            } else if (notification) {
              logger.info('📢 Other notification type in channel:', notification.type);
              this.emit('notification', notification);
            }
          } else {
            // Handle other channel message types
            this.handleChannelMessage(message.body);
          }
        }
        break;
      case 'noteUpdated':
        this.handleNoteUpdate(message.body);
        break;
      case 'notification':
        // Direct notification messages (legacy path)
        logger.info('🔔 DIRECT NOTIFICATION MESSAGE RECEIVED:', JSON.stringify(message, null, 2));
        this.handleNotification(message.body);
        break;
      default:
        logger.debug('❓ Unhandled message type:', message.type);
    }
  }

  handleChannelMessage(body) {
    logger.debug('Channel message received:', body.type, body.id || 'no id');
    
    // Check for case-insensitive mentions in timeline notes
    if (body.type === 'note' && body.body && body.body.text) {
      const noteText = body.body.text;
      if (this.isBotMentioned(noteText)) {
        logger.info(`🎯 Case-insensitive mention detected in note: "${noteText}"`);
        // Create a synthetic mention notification
        this.emit('mention', {
          type: 'mention',
          note: body.body,
          caseSensitiveOverride: true
        });
      }
    }
    
    // Handle messaging channel messages
    if (body.type === 'messagingMessage') {
      this.emit('messagingMessage', body.body);
    }
    // Handle direct messages
    else if (body.type === 'message') {
      this.emit('directMessage', body.body);
    }
    // Handle timeline notes
    else if (body.type === 'note') {
      logger.debug('Timeline note received - checking if it mentions the bot');
      // We might need to handle mentions that come through timeline
      // Let's emit them and let the bot decide if it should respond
      this.emit('timelineNote', body.body);
    }
    // Log other channel message types for debugging
    else {
      logger.debug('Other channel message type:', body.type);
    }
  }

  handleNoteUpdate(note) {
    this.emit('noteUpdate', note);
  }

  handleNotification(notification) {
    logger.info('🔔 Received notification:', notification.type);
    logger.info('📋 Full notification structure:', JSON.stringify(notification, null, 2));

    // Check if this is a mention but wasn't caught due to case sensitivity
    if (notification.type !== 'mention' && 
        notification.note && 
        notification.note.text && 
        this.isBotMentioned(notification.note.text)) {
      
      logger.info('📌 Converting to mention due to case-insensitive match');
      notification.type = 'mention';
      notification.caseSensitiveOverride = true;
    }

    // Handle specific notification types
    switch (notification.type) {
      case 'mention':
        logger.info('📌 Processing mention notification...');
        logger.info('📌 Mention notification data keys:', Object.keys(notification));
        if (notification.note) {
          logger.info('📌 Found note in notification.note');
        }
        if (notification.body) {
          logger.info('📌 Found body in notification, keys:', Object.keys(notification.body));
        }
        this.emit('mention', notification);
        break;
      case 'reply':
        logger.info('💬 Processing reply notification...');
        this.emit('reply', notification);
        break;
      case 'groupInvited':
        logger.info('👥 Processing group invite notification...');
        this.emit('groupInvite', notification);
        break;
      default:
        // Only emit general notification for unhandled types
        logger.debug('❓ Unhandled notification type:', notification.type);
        this.emit('notification', notification);
    }
  }

  // Note: Timeline connections disabled to prevent bot from responding to all posts
  // Bot now only responds to mentions (via notifications) and direct messages
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
    // Try connecting to both notification channels to ensure we catch mentions
    this.send({
      type: 'connect',
      body: {
        channel: 'main',
        id: uuidv4()
      }
    });
    logger.debug('Connected to main notifications channel');
    
    // Also connect to a notifications-specific channel
    this.send({
      type: 'connect',
      body: {
        channel: 'notifications',
        id: uuidv4()
      }
    });
    logger.debug('Connected to notifications channel');
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

  connectToMessaging() {
    this.send({
      type: 'connect',
      body: {
        channel: 'messaging',
        id: uuidv4()
      }
    });
    logger.debug('Connected to messaging channel');
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
