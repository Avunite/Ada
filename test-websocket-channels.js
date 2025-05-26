// Test script to discover correct Barkle WebSocket channels
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import config from './src/config.js';

console.log('🔍 Testing Barkle WebSocket channels...\n');

const ws = new WebSocket(config.barkleWssUrl, {
  headers: {
    'Authorization': `Bearer ${config.barkleApiKey}`
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully');
  
  // Try different channel combinations
  const channels = [
    'main',
    'homeTimeline', 
    'globalTimeline',
    'localTimeline',
    'mentions',
    'notifications',
    'hybrid',
    'social'
  ];
  
  console.log('\n📡 Subscribing to channels:');
  channels.forEach(channel => {
    const message = {
      type: 'connect',
      body: {
        channel: channel,
        id: uuidv4()
      }
    };
    
    console.log(`   Subscribing to: ${channel}`);
    ws.send(JSON.stringify(message));
  });
  
  console.log('\n⏰ Waiting for messages...\n');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:');
    console.log(JSON.stringify(message, null, 2));
    console.log('---');
  } catch (error) {
    console.log('❌ Failed to parse message:', data.toString());
  }
});

ws.on('close', (code, reason) => {
  console.log(`❌ WebSocket closed: ${code} - ${reason}`);
});

ws.on('error', (error) => {
  console.log('❌ WebSocket error:', error.message);
});

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('\n🛑 Test complete, closing connection...');
  ws.close();
  process.exit(0);
}, 30000);
