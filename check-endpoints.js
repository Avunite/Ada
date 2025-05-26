// Quick script to check Barkle API endpoints we're using
import axios from 'axios';
import config from './src/config.js';

async function checkEndpoints() {
  try {
    const client = axios.create({
      baseURL: config.barkleApiUrl,
      headers: {
        'Authorization': `Bearer ${config.barkleApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('🔍 Checking Barkle API endpoints we use in the bot...\n');

    // Endpoints we're using in the bot
    const endpointsToCheck = [
      'i',                    // getMyInfo()
      'notes',               // sendMessage()
      'notes/show',          // getNote()
      'users/show',          // getUserInfo(), getUserProfile()
      'notes/search',        // searchNotes()
      'following/create',    // followUser()
      'following/delete',    // unfollowUser()
      'blocking/create',     // blockUser()
      'blocking/delete',     // unblockUser()
    ];

    for (const endpoint of endpointsToCheck) {
      try {
        console.log(`\n📋 Checking endpoint: ${endpoint}`);
        const endpointResponse = await client.post('/endpoint', { endpoint });
        console.log(`✅ ${endpoint}:`, JSON.stringify(endpointResponse.data, null, 2));
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.response?.status || error.message}`);
        if (error.response?.data) {
          console.log(`   Error details:`, error.response.data);
        }
      }
    }

  } catch (error) {
    console.error('❌ Failed to check endpoints:', error.response?.data || error.message);
  }
}

checkEndpoints();
