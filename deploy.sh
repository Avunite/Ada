#!/bin/bash

# Ada Bot Deployment Script
# This script helps with common deployment tasks

set -e

echo "🤖 Ada Bot Deployment Script"
echo "============================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check npm
if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js $(node --version) found"
echo "✅ npm $(npm --version) found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your configuration before running the bot."
    else
        echo "❌ .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

# Validate required files
required_files=("system.txt" "index.js" "bot.js" "config.js")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Required file $file not found."
        exit 1
    fi
done

echo "✅ All required files found"

# Run basic configuration check
echo "🔍 Running configuration check..."
node -e "
try {
    const config = require('./config.js');
    console.log('✅ Configuration loaded successfully');
} catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
}
"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys and configuration"
echo "2. Optionally edit system.txt to customize the bot's personality"
echo "3. Run the bot with: npm start"
echo ""
echo "For help: npm start help"
