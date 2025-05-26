import BasePlugin from './base-plugin.js';
import fs from 'fs';
import path from 'path';

/**
 * Statistics Plugin
 * Tracks bot usage statistics and provides insights
 */
export default class StatsPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'Statistics';
    this.version = '1.0.0';
    this.description = 'Tracks bot usage statistics and provides insights';
    
    this.stats = {
      messagesProcessed: 0,
      responsesGenerated: 0,
      mentionsReceived: 0,
      directMessages: 0,
      groupsJoined: 0,
      groupsLeft: 0,
      uptime: Date.now(),
      userInteractions: new Map(),
      hourlyStats: new Map()
    };

    this.statsFile = path.join(process.cwd(), 'stats.json');
    
    // Register hooks
    this.hooks = {
      'beforeProcess': this.trackMessageProcessed.bind(this),
      'afterResponse': this.trackResponseGenerated.bind(this),
      'onNotification': this.trackNotification.bind(this)
    };
  }

  async initialize() {
    this.info('Statistics plugin initialized');
    
    // Load existing stats
    await this.loadStats();
    
    // Save stats every 5 minutes
    setInterval(() => {
      this.saveStats();
    }, 5 * 60 * 1000);
  }

  async trackMessageProcessed(data, context) {
    this.stats.messagesProcessed++;
    
    const { note } = data;
    if (note && note.user) {
      // Track user interactions
      const userId = note.user.id;
      if (!this.stats.userInteractions.has(userId)) {
        this.stats.userInteractions.set(userId, {
          username: note.user.username,
          messageCount: 0,
          firstInteraction: Date.now(),
          lastInteraction: Date.now()
        });
      }
      
      const userStats = this.stats.userInteractions.get(userId);
      userStats.messageCount++;
      userStats.lastInteraction = Date.now();
      
      // Track if it's a DM or mention
      const isDM = !note.channelId || note.visibility === 'specified';
      if (isDM) {
        this.stats.directMessages++;
      }
    }

    // Track hourly stats
    const hour = new Date().getHours();
    if (!this.stats.hourlyStats.has(hour)) {
      this.stats.hourlyStats.set(hour, { messages: 0, responses: 0 });
    }
    this.stats.hourlyStats.get(hour).messages++;

    return data;
  }

  async trackResponseGenerated(data, context) {
    this.stats.responsesGenerated++;
    
    // Track hourly responses
    const hour = new Date().getHours();
    if (!this.stats.hourlyStats.has(hour)) {
      this.stats.hourlyStats.set(hour, { messages: 0, responses: 0 });
    }
    this.stats.hourlyStats.get(hour).responses++;

    return data;
  }

  async trackNotification(data, context) {
    const { notification } = data;
    
    if (notification.type === 'mention') {
      this.stats.mentionsReceived++;
    } else if (notification.type === 'groupInvited') {
      this.stats.groupsJoined++;
    }

    return data;
  }

  async loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
        
        // Merge loaded stats with current stats
        this.stats = {
          ...this.stats,
          ...data,
          userInteractions: new Map(data.userInteractions || []),
          hourlyStats: new Map(data.hourlyStats || [])
        };
        
        this.debug('Statistics loaded from file');
      }
    } catch (error) {
      this.warn('Failed to load statistics:', error.message);
    }
  }

  async saveStats() {
    try {
      const statsToSave = {
        ...this.stats,
        userInteractions: Array.from(this.stats.userInteractions.entries()),
        hourlyStats: Array.from(this.stats.hourlyStats.entries())
      };
      
      fs.writeFileSync(this.statsFile, JSON.stringify(statsToSave, null, 2));
      this.debug('Statistics saved to file');
    } catch (error) {
      this.error('Failed to save statistics:', error.message);
    }
  }

  getStats() {
    const currentTime = Date.now();
    const uptimeMs = currentTime - this.stats.uptime;
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ...this.stats,
      uptimeFormatted: `${uptimeHours}h ${uptimeMinutes}m`,
      uptimeMs,
      topUsers: this.getTopUsers(),
      peakHours: this.getPeakHours()
    };
  }

  getTopUsers(limit = 5) {
    return Array.from(this.stats.userInteractions.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, limit);
  }

  getPeakHours(limit = 3) {
    return Array.from(this.stats.hourlyStats.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, limit);
  }

  async cleanup() {
    await this.saveStats();
    this.info('Statistics plugin cleaned up');
  }
}
