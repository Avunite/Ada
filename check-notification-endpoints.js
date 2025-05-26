// Check notification-related endpoints
import axios from 'axios';
import config from './src/config.js';

async function checkNotificationEndpoints() {
  try {
    const client = axios.create({
      baseURL: config.barkleApiUrl,
      headers: {
        'Authorization': `Bearer ${config.barkleApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('🔍 Checking notification-related endpoints...\n');

    const endpointsToCheck = [
      'i/notifications',
      'notifications/mark-all-as-read', 
      'i/read-notification',
      'i/read-all-notifications',
      'notifications/read'
    ];

    for (const endpoint of endpointsToCheck) {
      try {
        console.log(`📋 Checking endpoint: ${endpoint}`);
        const response = await client.post('/endpoint', { endpoint });
        console.log(`✅ ${endpoint}:`, JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('Failed to check endpoints:', error.message);
  }
}

checkNotificationEndpoints();
