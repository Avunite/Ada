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

  async generateResponse(messages, systemPrompt = null) {
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

      logger.debug('Sending request to Avunite:', requestData);

      const response = await this.client.post('/chat/completions', requestData);
      
      if (response.data?.choices?.[0]?.message?.content) {
        const content = response.data.choices[0].message.content.trim();
        logger.debug('Received response from Avunite:', content);
        return content;
      }

      throw new Error('Invalid response format from Avunite API');
    } catch (error) {
      logger.error('Failed to generate response:', error.message);
      
      // Fallback response for errors
      if (error.response?.status === 429) {
        return "I'm currently experiencing high demand. Please try again in a moment.";
      } else if (error.response?.status >= 500) {
        return "I'm having some technical difficulties right now. Please try again later.";
      }
      
      return "I'm sorry, I'm having trouble processing your request right now.";
    }
  }

  async generateResponseFromText(text, context = [], systemPrompt = null) {
    const messages = [
      ...context,
      { role: 'user', content: text }
    ];

    return await this.generateResponse(messages, systemPrompt);
  }
}

export default new AvuniteClient();
