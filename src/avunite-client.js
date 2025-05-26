import axios from 'axios';
import config from './config.js';
import logger from './logger.js';

class AvuniteClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.avuniteUrl,
      headers: {
        'Authorization': `Bearer ${config.avuniteKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Avunite API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async generateResponse(messages, systemPrompt = null, tools = null) {
    try {
      const requestMessages = [];
      
      // Add system prompt if provided
      if (systemPrompt) {
        requestMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // Add conversation messages
      requestMessages.push(...messages);

      const requestData = {
        model: config.avuniteModel,
        messages: requestMessages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        requestData.tools = tools.map(tool => ({
          type: 'function',
          function: tool
        }));
        requestData.tool_choice = 'auto';
      }

      logger.debug('Sending request to Avunite:', requestData);

      const response = await this.client.post('/chat/completions', requestData);
      
      if (response.data?.choices?.[0]?.message) {
        const message = response.data.choices[0].message;
        logger.debug('Received response from Avunite:', message);
        return message;
      }

      throw new Error('Invalid response format from Avunite API');
    } catch (error) {
      logger.error('Failed to generate response:', error.message);
      
      // Fallback response for errors
      if (error.response?.status === 429) {
        return { content: "I'm currently experiencing high demand. Please try again in a moment." };
      } else if (error.response?.status >= 500) {
        return { content: "I'm having some technical difficulties right now. Please try again later." };
      }
      
      return { content: "I'm sorry, I'm having trouble processing your request right now." };
    }
  }

  async generateResponseFromText(text, context = [], systemPrompt = null, tools = null) {
    const messages = [
      ...context,
      { role: 'user', content: text }
    ];

    return await this.generateResponse(messages, systemPrompt, tools);
  }

  async generateResponseWithTools(text, context = [], systemPrompt = null, tools = null) {
    const message = await this.generateResponseFromText(text, context, systemPrompt, tools);
    
    // Return just the content if no tools are involved
    if (!message.tool_calls) {
      return message.content?.trim() || message.content;
    }

    // Return the full message for tool processing
    return message;
  }
}

export default new AvuniteClient();
