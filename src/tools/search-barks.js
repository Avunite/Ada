import BaseTool from './base-tool.js';
import barkleClient from '../barkle-client.js';

/**
 * Search Barks Tool
 * Searches for posts/notes on Barkle using the search endpoint
 */
export default class SearchBarksTool extends BaseTool {
  constructor() {
    super();
    this.name = 'search_barks';
    this.description = 'Search for posts/notes on Barkle using keywords or phrases';
    this.parameters = {
      query: {
        type: 'string',
        description: 'Search query - keywords or phrases to search for',
        required: true
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 100)',
        required: false
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination (default: 0)',
        required: false
      },
      userId: {
        type: 'string',
        description: 'Filter results by specific user ID',
        required: false
      },
      channelId: {
        type: 'string',
        description: 'Filter results by specific channel/group ID',
        required: false
      }
    };
  }

  async execute(params, context) {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    const { query, limit = 10, offset = 0, userId, channelId } = params;

    try {
      this.debug(`Searching for: "${query}" with limit: ${limit}`);

      const searchParams = {
        query: query,
        limit: Math.min(limit, 100), // Cap at 100
        offset: offset
      };

      if (userId) {
        searchParams.userId = userId;
      }

      if (channelId) {
        searchParams.channelId = channelId;
      }

      const results = await barkleClient.searchNotes(searchParams);
      
      const formattedResults = results.map(note => ({
        id: note.id,
        text: note.text,
        user: {
          id: note.user?.id,
          username: note.user?.username,
          displayName: note.user?.name || note.user?.username
        },
        createdAt: note.createdAt,
        repliesCount: note.repliesCount || 0,
        reactionsCount: note.reactions ? Object.values(note.reactions).reduce((a, b) => a + b, 0) : 0,
        url: note.url || `https://barkle.chat/barks/${note.id}`
      }));

      this.info(`Found ${formattedResults.length} results for query: "${query}"`);

      return {
        success: true,
        query: query,
        results: formattedResults,
        totalFound: formattedResults.length,
        hasMore: formattedResults.length === limit
      };

    } catch (error) {
      this.error('Search failed:', error.message);
      return {
        success: false,
        error: error.message,
        query: query,
        results: []
      };
    }
  }
}
