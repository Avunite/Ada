import BasePlugin from './base-plugin.js';

/**
 * Auto Response Plugin
 * Provides automatic responses for common greetings and phrases
 */
export default class AutoResponsePlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'AutoResponse';
    this.version = '1.0.0';
    this.description = 'Provides automatic responses for common greetings';
    
    this.responses = new Map([
      ['hello', ['Hello!', 'Hi there!', 'Hey!', 'Greetings!']],
      ['hi', ['Hi!', 'Hello!', 'Hey there!']],
      ['thanks', ['You\'re welcome!', 'No problem!', 'Happy to help!', 'Anytime!']],
      ['thank you', ['You\'re very welcome!', 'My pleasure!', 'Glad I could help!']],
      ['good morning', ['Good morning!', 'Morning!', 'Hope you have a great day!']],
      ['good night', ['Good night!', 'Sweet dreams!', 'Sleep well!']],
      ['how are you', ['I\'m doing well, thank you!', 'Great! How are you?', 'I\'m good! Thanks for asking!']]
    ]);

    // Register hooks
    this.hooks = {
      'beforeResponse': this.handleBeforeResponse.bind(this)
    };
  }

  async initialize() {
    this.info('Auto Response plugin initialized');
  }

  async handleBeforeResponse(data, context) {
    const { message, note } = data;
    
    if (!message || typeof message !== 'string') {
      return data;
    }

    const lowerMessage = message.toLowerCase().trim();
    
    // Check for auto-response triggers
    for (const [trigger, responses] of this.responses.entries()) {
      if (lowerMessage.includes(trigger)) {
        // Add some personality to the response
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        this.debug(`Auto-response triggered for: ${trigger}`);
        
        // Modify the response to include the auto-response
        return {
          ...data,
          autoResponse: randomResponse,
          triggered: true
        };
      }
    }

    return data;
  }

  addResponse(trigger, responses) {
    if (Array.isArray(responses)) {
      this.responses.set(trigger.toLowerCase(), responses);
    } else {
      this.responses.set(trigger.toLowerCase(), [responses]);
    }
  }

  removeResponse(trigger) {
    this.responses.delete(trigger.toLowerCase());
  }

  getResponses() {
    return Object.fromEntries(this.responses);
  }
}
