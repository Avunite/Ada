import config from './config.js';
import logger from './logger.js';
import barkleClient from './barkle-client.js';
import avuniteClient from './avunite-client.js';
import pluginManager from './plugin-manager.js';
import toolManager from './tool-manager.js';
import userContextManager from './user-context-manager.js';
import databaseManager from './database-manager.js';
import memoryManager from './memory-manager.js';

class MessageHandler {
  constructor() {
    this.botUserId = null;
    this.botUsername = config.botUsername; // Keep original case
    this.conversationContext = new Map(); // Store conversation context
    this.processedMessageIds = new Set(); // Track processed DM message IDs
    
    // Set up periodic cache cleanup
    setInterval(() => {
      userContextManager.cleanupCache();
      this.cleanupConversationContext();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Set up periodic memory cleanup (daily)
    setInterval(() => {
      this.cleanupUserMemories();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    // Note: DM polling disabled - using WebSocket for real-time DMs
    // setInterval(() => {
    //   this.pollForDirectMessages();
    // }, 10 * 1000);
  }

  async initialize() {
    try {
      const myInfo = await barkleClient.getMyInfo();
      this.botUserId = myInfo.id;
      logger.info(`Bot initialized with ID: ${this.botUserId}`);
      
      // Update notification settings to ensure mentions are not muted
      try {
        await barkleClient.updateNotificationSettings();
        logger.info('✅ Notification settings updated successfully');
      } catch (error) {
        logger.warn('⚠️ Failed to update notification settings:', error.message);
      }
      
      // Note: DM polling disabled - using WebSocket for real-time DMs
      // logger.info('🔄 Starting DM polling...');
      // setTimeout(() => this.pollForDirectMessages(), 2000); // Start after 2 seconds
    } catch (error) {
      logger.error('Failed to initialize bot info:', error.message);
    }
  }

  // Note: This method is no longer used for timeline processing
  // Bot now only responds via handleMention, handleReply, and handleDirectMessage
  async handleNote(note) {
    // Skip our own messages
    if (note.userId === this.botUserId) {
      return;
    }

    logger.debug('Processing note (legacy method):', note);

    // Check if this is a direct message or mention
    const isDM = this.isDirectMessage(note);
    const isMention = this.isMentioned(note);

    if (isDM || isMention) {
      await this.processMessage(note, isDM, isMention);
    }
  }

  async handleMention(notification) {
    logger.info('🔔 Handling mention notification:', JSON.stringify(notification, null, 2));
    
    if (notification.note) {
      logger.info('✅ Found note in mention notification, processing...');
      await this.processMessage(notification.note, false, true);
    } else {
      logger.warn('❌ No note found in mention notification. Available keys:', Object.keys(notification));
      
      // Try alternative structures that might contain the note data
      if (notification.body?.note) {
        logger.info('✅ Found note in notification.body.note, processing...');
        await this.processMessage(notification.body.note, false, true);
      } else if (notification.content) {
        logger.info('✅ Found content in notification.content, processing...');
        await this.processMessage(notification.content, false, true);
      } else {
        logger.error('❌ Could not find note data in mention notification structure');
      }
    }
  }

  async handleReply(notification) {
    logger.info('🔔 Handling reply notification:', JSON.stringify(notification, null, 2));
    
    if (notification.note) {
      logger.info('✅ Found note in reply notification, processing as mention...');
      // All replies to our messages should be processed as mentions
      await this.processMessage(notification.note, false, true);
    } else {
      logger.warn('❌ No note found in reply notification. Available keys:', Object.keys(notification));
      
      // Try alternative structures that might contain the note data
      if (notification.body?.note) {
        logger.info('✅ Found note in notification.body.note, processing...');
        await this.processMessage(notification.body.note, false, true);
      } else if (notification.content) {
        logger.info('✅ Found content in notification.content, processing...');
        await this.processMessage(notification.content, false, true);
      } else {
        logger.error('❌ Could not find note data in reply notification structure');
      }
    }
  }

  async handleGroupInvite(notification) {
    logger.info('Received group invitation:', JSON.stringify(notification, null, 2));
    
    try {
      // Check different possible structures for the notification
      let groupId = null;
      
      if (notification.invite && notification.invite.group) {
        groupId = notification.invite.group.id;
        logger.info('Found group ID in notification.invite.group.id:', groupId);
      } else if (notification.group) {
        groupId = notification.group.id;
        logger.info('Found group ID in notification.group.id:', groupId);
      } else if (notification.groupId) {
        groupId = notification.groupId;
        logger.info('Found group ID in notification.groupId:', groupId);
      } else {
        logger.error('Could not find group ID in notification structure:', Object.keys(notification));
        return;
      }
      
      if (groupId) {
        logger.info('Attempting to join group:', groupId);
        await barkleClient.joinGroup(groupId);
        logger.info('Successfully joined group, sending greeting message...');
        
        // Send a greeting message to the group
        await barkleClient.sendMessage(
          `Hello everyone! I'm ${config.botName}, thanks for inviting me to the group. I'm here to help and chat! 🤖`,
          { channelId: groupId }
        );
        
        logger.info('Successfully handled group invitation and sent greeting message');
      }
    } catch (error) {
      logger.error('Failed to handle group invitation:', error.message);
      logger.error('Error stack:', error.stack);
    }
  }

  async handleDirectMessage(message) {
    logger.info('📨 Handling direct message from WebSocket:', message);

    // Skip our own messages
    if (message.userId === this.botUserId) {
      logger.debug('Skipping own message');
      return;
    }

    // Check if already processed
    if (this.processedMessageIds.has(message.id)) {
      logger.debug(`Message ${message.id} already processed, skipping`);
      return;
    }

    // Mark as processed
    this.processedMessageIds.add(message.id);

    // Clean up old processed IDs (keep last 1000)
    if (this.processedMessageIds.size > 1000) {
      const idsArray = Array.from(this.processedMessageIds);
      this.processedMessageIds = new Set(idsArray.slice(-500));
    }

    try {
      // Convert message to note format for processing
      const dmNote = {
        id: message.id,
        text: message.text,
        userId: message.userId,
        user: message.user || { id: message.userId },
        createdAt: message.createdAt || new Date().toISOString(),
        channelId: null // DMs don't have channel IDs
      };

      logger.info(`📥 Processing WebSocket DM from ${message.user?.username || message.userId}`);
      
      // Process as direct message
      await this.processMessage(dmNote, true, false);
      
    } catch (error) {
      logger.error('Error processing WebSocket direct message:', error.message);
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

      // Analyze and store memories from user message
      logger.debug('🧠 Analyzing message for memories...');
      await memoryManager.analyzeAndStoreMemories(note.userId, messageText, { userContext });
      
      // Get relevant memories for context
      const relevantMemories = await memoryManager.getRelevantMemories(note.userId, messageText, 8);
      const memoryContext = memoryManager.formatMemoriesForContext(relevantMemories);
      logger.debug(`🧠 Retrieved ${relevantMemories.length} relevant memories for context`);

      // Get conversation history from database
      logger.debug('📚 Fetching conversation history from database...');
      const conversationHistory = await databaseManager.getConversationHistory(note.userId);
      logger.debug(`📚 Loaded ${conversationHistory.length} messages from database`);

      // Store the user's message in database
      await databaseManager.storeMessages(note.userId, [{
        role: 'user',
        content: messageText
      }]);

      // Enhanced system prompt with user context and memories
      const enhancedSystemPrompt = `${config.systemPrompt}

User Context:
${userContext.context}${memoryContext}`;

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
    
    // Handle memory commands
    if (/^!memory|!mem$/i.test(lowerText)) {
      try {
        const memories = await memoryManager.getRelevantMemories(note.userId, '', 5);
        const stats = await memoryManager.getMemoryStatistics(note.userId);
        
        let response = `🧠 **Memory Status**\n`;
        response += `Total memories: ${stats?.total_memories || 0}\n`;
        response += `Memory types: ${stats?.memory_types || 0}\n\n`;
        
        if (memories.length > 0) {
          response += `**Recent/Important memories:**\n`;
          memories.slice(0, 3).forEach((memory, index) => {
            const importance = memory.importance > 7 ? '⭐ ' : '';
            response += `${index + 1}. ${importance}${memory.memory_value}\n`;
          });
        } else {
          response += `No memories stored yet. I'll remember things as we chat!`;
        }
        
        const isDM = this.isDirectMessage(note);
        if (isDM) {
          await barkleClient.sendDirectMessage(response, note.userId);
        } else {
          await barkleClient.sendMessage(response, {
            replyTo: note.id,
            channelId: note.channelId
          });
        }
        return true;
      } catch (error) {
        logger.error('Failed to get memory status:', error.message);
        return false;
      }
    }

    // Handle memory clearing commands
    if (/^!clearmemory|!forgetme$/i.test(lowerText)) {
      try {
        const cleared = await databaseManager.clearUserMemories(note.userId);
        
        const response = cleared > 0 
          ? `🧠 Cleared ${cleared} memories. Starting fresh! 🔄`
          : `🧠 No memories to clear.`;
        
        const isDM = this.isDirectMessage(note);
        if (isDM) {
          await barkleClient.sendDirectMessage(response, note.userId);
        } else {
          await barkleClient.sendMessage(response, {
            replyTo: note.id,
            channelId: note.channelId
          });
        }
        return true;
      } catch (error) {
        logger.error('Failed to clear memories:', error.message);
        return false;
      }
    }

    // Handle remember command
    if (lowerText.startsWith('!remember ')) {
      try {
        const memoryText = text.substring(10).trim(); // Remove "!remember "
        if (memoryText) {
          await memoryManager.storeSpecificMemory(
            note.userId, 
            `manual_${Date.now()}`, 
            memoryText, 
            'important', 
            8
          );
          
          const response = `🧠 I'll remember that: "${memoryText}"`;
          
          const isDM = this.isDirectMessage(note);
          if (isDM) {
            await barkleClient.sendDirectMessage(response, note.userId);
          } else {
            await barkleClient.sendMessage(response, {
              replyTo: note.id,
              channelId: note.channelId
            });
          }
          return true;
        }
      } catch (error) {
        logger.error('Failed to store manual memory:', error.message);
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

**Commands:**
• Type "help" for this message
• Type "!cc" or "!clearcontext" to clear our conversation history
• Type "!memory" or "!mem" to see what I remember about you
• Type "!clearmemory" or "!forgetme" to clear all memories
• Type "!remember [text]" to manually store something important

**Memory Feature:**
I automatically remember important things you tell me like preferences, facts about yourself, interests, and more. This helps me provide more personalized responses over time!

I'm powered by AI and here to assist! 🤖`;

      await barkleClient.sendMessage(helpMessage, {
        replyTo: note.id,
        channelId: note.channelId
      });
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

  async cleanupUserMemories() {
    try {
      logger.info('🧠 Starting periodic memory cleanup...');
      
      // Get all users who have memories
      const allMemories = await databaseManager.db.all(
        'SELECT DISTINCT user_id FROM user_memories'
      );
      
      let totalCleaned = 0;
      for (const { user_id } of allMemories) {
        const cleaned = await memoryManager.cleanupMemories(user_id, 150); // Keep 150 memories per user
        totalCleaned += cleaned;
      }
      
      if (totalCleaned > 0) {
        logger.info(`🧠 Memory cleanup complete: removed ${totalCleaned} old memories`);
      }
    } catch (error) {
      logger.error('Error during memory cleanup:', error.message);
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
    
    const mentions = note.mentions || [];
    const text = note.text.toLowerCase();
    
    // Check if we're in the mentions array (primary method)
    const mentionedById = mentions.some(mention => mention.id === this.botUserId);
    
    // Also check for case-insensitive text mentions as backup
    const mentionedByText = text.includes(`@${this.botUsername.toLowerCase()}`);
    
    return mentionedById || mentionedByText;
  }

  removeMentionFromText(text) {
    if (!text) return '';
    
    // Remove @username mentions (case-insensitive) and clean up extra spaces
    return text
      .replace(new RegExp(`@${this.botUsername}\\b`, 'gi'), '')
      .replace(/@\w+/g, '') // Remove other mentions for cleaner context
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
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
