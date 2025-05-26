# Ada Bot - Barkle AI Assistant

Ada is a powerful, pluggable AI bot for Barkle that connects to OpenAI-like APIs and provides intelligent responses via WebSocket communication.

## Features

### Core Features
- 🤖 **AI-Powered Responses**: Connects to any OpenAI-compatible API
- 🔌 **WebSocket Communication**: Real-time message handling via WebSocket
- 💬 **Smart Conversation Handling**: Tracks conversation threads and context
- 📧 **Direct Message Support**: Responds to DMs automatically
- 🏷️ **Mention Detection**: Responds when mentioned with @username
- 🏠 **Group Management**: Auto-joins groups when invited, leaves on request

### Agent Mode & Tools
- 🛠️ **Agent Tools**: React-style reasoning with function calling
- 🔍 **Search Tool**: Search Barkle posts and notes
- 👥 **Social Tools**: Follow, unfollow, block, unblock users
- 💌 **Direct Messaging**: Send DMs to users via tool calls
- 🧠 **Smart Reasoning**: AI decides when and how to use tools

### User Context & Profiles
- 👤 **User Profiles**: Automatic profile fetching and caching
- 📊 **Rich Context**: Display names, bios, account age, followers
- 🎂 **Personal Details**: Birthday, location, website information
- ⚡ **Smart Caching**: Efficient profile caching with TTL

### Plugin System
- 🧩 **Highly Extensible**: Custom plugin architecture
- 🛡️ **Built-in Moderation**: Rate limiting and spam detection
- 📈 **Statistics Tracking**: Usage analytics and metrics
- 🤝 **Auto-Response**: Smart greeting detection
- 📝 **Easy Development**: Simple plugin interface

## Quick Start

### 1. Installation

```bash
# Install dependencies
npm install
```

### 2. Configuration

Edit `.env` with your credentials:

```env
# Barkle Configuration
BARKLE_API_URL=https://barkle.chat/api
BARKLE_WSS_URL=https://barkle.chat/stream
BARKLE_API_KEY=your_barkle_api_key_here

# AI Service Configuration (OpenAI-compatible)
AVUNITE_URL=your_ai_service_url_here
AVUNITE_KEY=your_ai_service_key_here
AVUNITE_MODEL=your_preferred_model_name

# Bot Configuration
BOT_USERNAME=your_bot_username
SYSTEM_PATH=./system.txt
```

### 3. Customize System Prompt

Edit `system.txt` to customize your bot's personality.

### 4. Run the Bot

```bash
# Start the bot
npm start

# Or for development with auto-restart
npm run dev
```

## Usage

### Basic Interactions

- **Direct Message**: Send a DM to the bot for a private conversation
- **Mention**: Use `@botusername your message` to get the bot's attention
- **Thread Context**: The bot can see conversation history when replying to threads
- **Help**: Send "help" to get usage instructions

### Group Management

- **Join Groups**: Invite the bot to a group and it will join automatically
- **Leave Groups**: Ask the bot to "leave group" and it will exit gracefully

## Plugin System

Ada features a powerful plugin system for extending functionality.

### Built-in Plugins

- **Auto Response**: Handles common greetings and phrases
- **Moderation**: Rate limiting and spam detection

### Creating Custom Plugins

Create a new file in the `plugins/` directory and extend the `BasePlugin` class.

## Configuration Options

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BARKLE_API_URL` | Barkle API endpoint | `https://barkle.chat/api` |
| `BARKLE_WSS_URL` | Barkle WebSocket endpoint | `https://barkle.chat/stream` |
| `BARKLE_API_KEY` | Your Barkle API key | `your_api_key_here` |
| `AVUNITE_URL` | AI service endpoint | `https://api.example.com/v1` |
| `AVUNITE_KEY` | AI service API key | `your_ai_key_here` |
| `AVUNITE_MODEL` | AI model to use | `gpt-4` |
| `BOT_USERNAME` | Bot's username on Barkle | `ada_bot` |

## Development

The bot is built with a modular architecture using ES modules and a plugin system for extensibility.

## Troubleshooting

### Debug Mode

Set `LOG_LEVEL=debug` for detailed logging:

```bash
LOG_LEVEL=debug npm start
```

## License

ISC License - see package.json for details.
