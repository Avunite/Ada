import config from './config.js';
import logger from './logger.js';
import barkleClient from './barkle-client.js';
import avuniteClient from './avunite-client.js';
import pluginManager from './plugin-manager.js';

class MessageHandler {
  constructor() {
    this.botUserId = null;
    this.botUsername = config.botUsername.toLowerCase();
    this.conversationContext = new Map(); // Store conversation context
  }

  async initialize() {
    try {
      const myInfo = await barkleClient.getMyInfo();
      this.botUserId = myInfo.id;
      logger.info(`Bot initialized with ID: ${this.botUserId}`);
    } catch (error) {
      logger.error('Failed to initialize bot info:', error.message);
    }
  }

  async handleNote(note) {
    // Skip our own messages
    if (note.userId === this.botUserId) {
      return;
    }

    logger.debug('Processing note:', note);

    // Check if this is a direct message or mention
    const isDM = this.isDirectMessage(note);
    const isMention = this.isMentioned(note);

    if (isDM || isMention) {
      await this.processMessage(note, isDM, isMention);
    }
  }

  async handleMention(notification) {
    logger.info('Handling mention notification:', notification);
    
    if (notification.note) {
      await this.processMessage(notification.note, false, true);
    }
  }

  async handleReply(notification) {
    logger.info('Handling reply notification:', notification);
    
    if (notification.note) {
      // Check if the reply mentions us or is replying to our message
      const isMention = this.isMentioned(notification.note);
      if (isMention) {
        await this.processMessage(notification.note, false, true);
      }
    }
  }

  async handleGroupInvite(notification) {
    logger.info('Received group invitation:', notification);
    
    try {
      if (notification.invite && notification.invite.group) {
        const groupId = notification.invite.group.id;
        await barkleClient.joinGroup(groupId);
        
        // Send a greeting message to the group
        await barkleClient.sendMessage(
          `Hello everyone! I'm ${config.botName}, thanks for inviting me to the group. I'm here to help and chat! 🤖`,
          null,
          groupId
        );
      }
    } catch (error) {
      logger.error('Failed to handle group invitation:', error.message);
    }
  }

  async processMessage(note, isDM, isMention) {
    try {
      let messageText = note.text || '';
      
      // Remove mention from the text if it's a mention
      if (isMention) {
        messageText = this.removeMentionFromText(messageText);
      }

      // Check for special commands
      if (await this.handleSpecialCommands(messageText, note)) {
        return;
      }

      // Get conversation context if this is a reply
      let context = [];
      if (note.replyId) {
        context = await this.getConversationContext(note.replyId);
      }

      // Store the user's message in context
      this.addToConversationContext(note.id, {
        role: 'user',
        content: messageText,
        user: note.user?.username || 'unknown'
      });

      // Generate response using AI
      const responseData = await pluginManager.executeHook('beforeResponse', {
        message: messageText,
        note,
        context,
        systemPrompt: config.systemPrompt
      });

      let response;
      if (responseData.autoResponse && responseData.triggered) {
        // Use auto-response if triggered by plugin
        response = responseData.autoResponse;
      } else {
        // Generate AI response
        response = await avuniteClient.generateResponseFromText(
          messageText,
          context,
          config.systemPrompt
        );
      }

      // Allow plugins to modify the response
      const finalResponseData = await pluginManager.executeHook('afterResponse', {
        originalMessage: messageText,
        response,
        note,
        context
      });

      const finalResponse = finalResponseData.response || response;

      // Send the response
      await barkleClient.sendMessage(finalResponse, note.id, note.channelId);

      // Store bot's response in context
      this.addToConversationContext(note.id + '_response', {
        role: 'assistant',
        content: finalResponse
      });

      logger.info(`Responded to ${isDM ? 'DM' : 'mention'} from ${note.user?.username}`);
    } catch (error) {
      logger.error('Failed to process message:', error.message);
      
      // Send error response
      try {
        await barkleClient.sendMessage(
          "I'm sorry, I'm having trouble processing your message right now.",
          note.id,
          note.channelId
        );
      } catch (sendError) {
        logger.error('Failed to send error response:', sendError.message);
      }
    }
  }

  async handleSpecialCommands(text, note) {
    const lowerText = text.toLowerCase().trim();
    
    // Handle leave group command
    if (lowerText.includes('leave') && lowerText.includes('group')) {
      if (note.channelId) {
        try {
          await barkleClient.sendMessage(
            "Goodbye everyone! Thanks for having me. 👋",
            note.id,
            note.channelId
          );
          await barkleClient.leaveGroup(note.channelId);
          return true;
        } catch (error) {
          logger.error('Failed to leave group:', error.message);
          await barkleClient.sendMessage(
            "I'm sorry, I couldn't leave the group right now.",
            note.id,
            note.channelId
          );
          return true;
        }
      }
    }

    // Handle help command
    if (lowerText === 'help' || lowerText === '!help') {
      const helpMessage = `Hello! I'm ${config.botName}. Here's what I can do:
      
• Chat with me by mentioning me (@${config.botUsername}) or sending me a DM
• Ask me questions and I'll do my best to help
• I can see conversation context when replying to threads
• Invite me to groups and I'll join automatically
• Ask me to "leave group" if you want me to leave
• Type "help" for this message

I'm powered by AI and here to assist! 🤖`;

      await barkleClient.sendMessage(helpMessage, note.id, note.channelId);
      return true;
    }

    return false;
  }

  async getConversationContext(replyId) {
    try {
      const thread = await barkleClient.getConversationThread(replyId);
      
      return thread.map(message => ({
        role: message.user?.id === this.botUserId ? 'assistant' : 'user',
        content: message.text || '',
        user: message.user?.username || 'unknown'
      }));
    } catch (error) {
      logger.error('Failed to get conversation context:', error.message);
      return [];
    }
  }

  addToConversationContext(messageId, message) {
    // Store conversation context with a TTL of 1 hour
    this.conversationContext.set(messageId, {
      message,
      timestamp: Date.now()
    });

    // Clean up old context (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, data] of this.conversationContext.entries()) {
      if (data.timestamp < oneHourAgo) {
        this.conversationContext.delete(id);
      }
    }
  }

  isDirectMessage(note) {
    // A direct message typically doesn't have a channelId or has a specific DM channel type
    return !note.channelId || note.visibility === 'specified';
  }

  isMentioned(note) {
    if (!note.text) return false;
    
    const text = note.text.toLowerCase();
    const mentions = note.mentions || [];
    
    // Check if we're in the mentions array
    const mentionedById = mentions.some(mention => mention.id === this.botUserId);
    
    // Check if our username is mentioned in the text
    const mentionedByText = text.includes(`@${this.botUsername}`);
    
    return mentionedById || mentionedByText;
  }

  removeMentionFromText(text) {
    if (!text) return '';
    
    // Remove @username mentions
    return text
      .replace(new RegExp(`@${this.botUsername}\\b`, 'gi'), '')
      .replace(/@\w+/g, '') // Remove other mentions for cleaner context
      .trim();
  }
}

export default new MessageHandler();
