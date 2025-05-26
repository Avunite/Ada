// Quick script to discover Barkle API endpoints
import axios from 'axios';
import config from './src/config.js';

async function discoverEndpoints() {
  try {
    const client = axios.create({
      baseURL: config.barkleApiUrl,
      headers: {
        'Authorization': `Bearer ${config.barkleApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('🔍 Discovering Barkle API endpoints...\n');
    console.log(`Using API: ${config.barkleApiUrl}`);
    console.log(`Using Key: ${config.barkleApiKey ? config.barkleApiKey.substring(0, 8) + '...' : 'NOT SET'}\n`);

    // Try to get all endpoints
    try {
      console.log('Calling POST /endpoint with empty endpoint...');
      const response = await client.post('/endpoint', { endpoint: '' });
      console.log('📋 Available endpoints:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Failed to get all endpoints:', error.response?.status, error.response?.data || error.message);
    }

    // Try some common endpoints we might need
    const endpointsToCheck = [
      'users/show',
      'i',
      'me',
      'users/me',
      'account/verify_credentials',
      'notes',
      'notes/create',
      'following/create',
      'following/delete',
      'blocking/create',
      'blocking/delete',
      'notes/search'
    ];

    console.log('\n🔍 Checking specific endpoints:');
    for (const endpoint of endpointsToCheck) {
      try {
        const endpointResponse = await client.post('/endpoint', { endpoint });
        console.log(`✅ ${endpoint}:`, endpointResponse.data);
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.response?.status || error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Failed to discover endpoints:', error.response?.data || error.message);
  }
}

discoverEndpoints();
