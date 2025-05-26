import config from './config.js';
import logger from './logger.js';
import barkleClient from './barkle-client.js';
import avuniteClient from './avunite-client.js';
import pluginManager from './plugin-manager.js';
import toolManager from './tool-manager.js';
import userContextManager from './user-context-manager.js';
import databaseManager from './database-manager.js';

class MessageHandler {
  constructor() {
    this.botUserId = null;
    this.botUsername = config.botUsername.toLowerCase();
    this.conversationContext = new Map(); // Store conversation context
    this.processedMessageIds = new Set(); // Track processed DM message IDs
    
    // Set up periodic cache cleanup
    setInterval(() => {
      userContextManager.cleanupCache();
      this.cleanupConversationContext();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Set up DM polling (every 10 seconds)
    setInterval(() => {
      this.pollForDirectMessages();
    }, 10 * 1000);
  }

  async initialize() {
    try {
      const myInfo = await barkleClient.getMyInfo();
      this.botUserId = myInfo.id;
      logger.info(`Bot initialized with ID: ${this.botUserId}`);
      
      // Start DM polling immediately after initialization
      logger.info('🔄 Starting DM polling...');
      setTimeout(() => this.pollForDirectMessages(), 2000); // Start after 2 seconds
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
      logger.info(`🔄 PROCESSING MESSAGE: ${isDM ? 'DM' : 'MENTION'} from ${note.user?.username || 'unknown'}`);
      logger.debug(`📝 Original note:`, note);
      
      let messageText = note.text || '';
      
      // Remove mention from the text if it's a mention
      if (isMention) {
        messageText = this.removeMentionFromText(messageText);
      }

      logger.debug(`📝 Processed message text: "${messageText}"`);

      // Check for special commands
      if (await this.handleSpecialCommands(messageText, note)) {
        logger.info('✅ Handled as special command');
        return;
      }

      // Check message limits for non-Plus users
      const userInfo = note.user || await barkleClient.getUserInfo(note.userId);
      const canSendMessage = await databaseManager.checkMessageLimit(note.userId, userInfo.isPlus || false);
      
      if (canSendMessage !== true) {
        if (canSendMessage.limitReached) {
          const limitMessage = `Message limit reached. **Subscribe to Barkle+ to get unlimited messages to ${config.botName}.**\nSubscribe here: https://barkle.chat/settings/manage-plus You can send messages again at ${canSendMessage.resetTime}.`;
          
          if (isDM) {
            await barkleClient.sendDirectMessage(limitMessage, note.userId);
          } else {
            await barkleClient.sendMessage(limitMessage, {
              replyTo: note.id,
              channelId: note.channelId
            });
          }
          return;
        }
      }

      // Get user context
      logger.debug('🔍 Fetching user context...');
      const userContext = await userContextManager.getUserContext(note.userId);
      logger.info(`👤 User context loaded for ${userContext.username}`);

      // Get conversation history from database
      logger.debug('📚 Fetching conversation history from database...');
      const conversationHistory = await databaseManager.getConversationHistory(note.userId);
      logger.debug(`📚 Loaded ${conversationHistory.length} messages from database`);

      // Store the user's message in database
      await databaseManager.storeMessages(note.userId, [{
        role: 'user',
        content: messageText
      }]);

      // Enhanced system prompt with user context
      const enhancedSystemPrompt = `${config.systemPrompt}

User Context:
${userContext.context}`;

      // Get updated conversation history (including the new message)
      const updatedHistory = await databaseManager.getConversationHistory(note.userId);

      // Generate response using AI with tools
      logger.info('🤖 Generating AI response...');
      const responseData = await pluginManager.executeHook('beforeResponse', {
        message: messageText,
        note,
        context: updatedHistory,
        userContext,
        systemPrompt: enhancedSystemPrompt
      });

      let response;
      if (responseData.autoResponse && responseData.triggered) {
        // Use auto-response if triggered by plugin
        logger.info('🔄 Using plugin auto-response');
        response = responseData.autoResponse;
      } else {
        // Generate AI response with agent mode (tools)
        logger.info('🛠️ Generating agent response with tools...');
        response = await this.generateAgentResponse(
          messageText,
          updatedHistory,
          enhancedSystemPrompt,
          { note, userContext }
        );
      }

      logger.info(`💬 Generated response: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);

      // Allow plugins to modify the response
      const finalResponseData = await pluginManager.executeHook('afterResponse', {
        originalMessage: messageText,
        response,
        note,
        context: updatedHistory,
        userContext
      });

      const finalResponse = finalResponseData.response || response;
      logger.info(`📤 Final response to send: "${finalResponse.substring(0, 100)}${finalResponse.length > 100 ? '...' : ''}"`);

      // Send the response
      logger.info(`🚀 Attempting to send message reply...`);
      
      if (isDM) {
        // For DMs, use the direct message endpoint
        await barkleClient.sendDirectMessage(finalResponse, note.userId);
      } else {
        // For mentions and replies, use the regular message endpoint
        await barkleClient.sendMessage(finalResponse, { 
          replyTo: note.id,
          channelId: note.channelId 
        });
      }

      // Store bot's response in database
      await databaseManager.storeMessages(note.userId, [{
        role: 'assistant',
        content: finalResponse
      }]);

      logger.info(`✅ Successfully responded to ${isDM ? 'DM' : 'mention'} from ${userContext.username}`);
    } catch (error) {
      logger.error('❌ FAILED TO PROCESS MESSAGE:', {
        error: error.message,
        stack: error.stack,
        note: { id: note.id, userId: note.userId, text: note.text }
      });
      
      // Send error response
      try {
        logger.info('🔄 Attempting to send error response...');
        if (isDM) {
          await barkleClient.sendDirectMessage(
            "I'm sorry, I'm having trouble processing your message right now.",
            note.userId
          );
        } else {
          await barkleClient.sendMessage(
            "I'm sorry, I'm having trouble processing your message right now.",
            { 
              replyTo: note.id,
              channelId: note.channelId 
            }
          );
        }
        logger.info('✅ Error response sent successfully');
      } catch (sendError) {
        logger.error('❌ Failed to send error response:', sendError.message);
      }
    }
  }

  async handleSpecialCommands(text, note) {
    const lowerText = text.toLowerCase().trim();
    
    // Handle context clearing commands
    if (/^!cc|!clearcontext$/i.test(lowerText)) {
      try {
        await databaseManager.clearContext(note.userId);
        
        const isDM = this.isDirectMessage(note);
        if (isDM) {
          await barkleClient.sendDirectMessage("Context cleared! 🧹", note.userId);
        } else {
          await barkleClient.sendMessage("Context cleared! 🧹", {
            replyTo: note.id,
            channelId: note.channelId
          });
        }
        return true;
      } catch (error) {
        logger.error('Failed to clear context:', error.message);
        return false;
      }
    }
    
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
• Type "!cc" or "!clearcontext" to clear our conversation history

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
        name: message.user?.username || 'unknown'
      }));
    } catch (error) {
      logger.error('Failed to get conversation context:', error.message);
      return [];
    }
  }  addToConversationContext(messageId, message) {
    // Store conversation context with a TTL of 1 hour
    this.conversationContext.set(messageId, {
      message,
      timestamp: Date.now()
    });
  }

  cleanupConversationContext() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let cleanedCount = 0;
    
    for (const [id, data] of this.conversationContext.entries()) {
      if (data.timestamp < oneHourAgo) {
        this.conversationContext.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old conversation context entries`);
    }
  }

  async pollForDirectMessages() {
    try {
      if (!this.botUserId) {
        return; // Bot not initialized yet
      }

      logger.debug('🔍 Polling for new direct messages...');
      
      const messagingHistory = await barkleClient.getMessagingHistory(20);
      
      if (messagingHistory && messagingHistory.length > 0) {
        // Check for unread messages
        const unreadMessages = messagingHistory.filter(conversation => 
          !conversation.isRead && 
          conversation.userId !== this.botUserId && // Not from the bot itself
          !this.processedMessageIds.has(conversation.id)
        );

        for (const conversation of unreadMessages) {
          logger.info(`📨 Found unread DM from ${conversation.user?.username || 'unknown'}`);
          
          // Check for clear context commands first
          if (conversation.lastMessage && typeof conversation.lastMessage.text === 'string' && 
              /^!cc|!clearcontext$/i.test(conversation.lastMessage.text.trim())) {
            await databaseManager.clearContext(conversation.userId);
            await barkleClient.sendDirectMessage("Context cleared! 🧹", conversation.userId);
            this.processedMessageIds.add(conversation.id);
            continue;
          }
          
          // Get the latest message from this user
          const userMessages = await barkleClient.getMessagesForUser(conversation.userId, 1);
          
          if (userMessages && userMessages.length > 0) {
            const latestMessage = userMessages[0];
            
            // Mark as processed to avoid duplicate handling
            this.processedMessageIds.add(conversation.id);
            this.processedMessageIds.add(latestMessage.id);
            
            // Clean up old processed IDs (keep last 1000)
            if (this.processedMessageIds.size > 1000) {
              const idsArray = Array.from(this.processedMessageIds);
              this.processedMessageIds = new Set(idsArray.slice(-500));
            }
            
            // Process as DM
            const dmNote = {
              id: latestMessage.id,
              userId: latestMessage.userId,
              user: latestMessage.user || conversation.user,
              text: latestMessage.text || '',
              file: latestMessage.file,
              createdAt: latestMessage.createdAt,
              channelId: null, // DMs don't have channel IDs
              visibility: 'specified' // Mark as DM
            };
            
            logger.info(`📨 Processing DM from ${dmNote.user?.username || 'unknown'}: "${dmNote.text?.substring(0, 50) || ''}"`);
            await this.processMessage(dmNote, true, false);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to poll for direct messages:', error.message);
    }
  }

  isDirectMessage(note) {
    // A direct message typically doesn't have a channelId or has a specific DM channel type
    // Also check for visibility specified which indicates a DM
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

  async generateAgentResponse(messageText, context, systemPrompt, executionContext) {
    try {
      const tools = toolManager.getToolSchemas();
      logger.debug(`Available tools: ${tools.map(t => t.name).join(', ')}`);

      // Initial AI request with tools
      const aiResponse = await avuniteClient.generateResponseWithTools(
        messageText,
        context,
        systemPrompt,
        tools
      );

      // If no tool calls, return the response directly
      if (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0) {
        return aiResponse.content || aiResponse;
      }

      logger.info(`AI requested ${aiResponse.tool_calls.length} tool calls`);

      // Execute tool calls
      const toolResults = await toolManager.executeToolCalls(
        aiResponse.tool_calls,
        executionContext
      );

      // Create messages for the next AI call with tool results
      const toolMessages = [
        ...context,
        { role: 'user', content: messageText },
        { role: 'assistant', content: aiResponse.content || '', tool_calls: aiResponse.tool_calls },
        ...toolResults.map(result => ({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: JSON.stringify(result.success ? result.result : { error: result.error })
        }))
      ];

      // Get final response from AI after tool execution
      const finalResponse = await avuniteClient.generateResponse(
        toolMessages,
        systemPrompt
      );

      return finalResponse.content || finalResponse;
    } catch (error) {
      logger.error('Agent response generation failed:', error.message);
      
      // Fallback to simple response
      return await avuniteClient.generateResponseFromText(
        messageText,
        context,
        systemPrompt
      );
    }
  }
}

export default new MessageHandler();
