import barkleClient from './src/barkle-client.js';

async function testBot() {
  console.log('🔍 Checking bot status and notifications...');

  try {
    console.log('Getting profile...');
    const profile = await barkleClient.getMyInfo();
    console.log('✅ Bot Profile:', {
      id: profile.id,
      username: profile.username,
      displayName: profile.name,
      description: profile.description,
      isBot: profile.isBot,
      isCat: profile.isCat,
      mutedNotificationTypes: profile.mutingNotificationTypes
    });
    
    // Update notification settings to unmute mentions and replies
    console.log('\n📱 Updating notification settings...');
    await barkleClient.updateNotificationSettings();
    
    // Test sending a simple message with corrected parameters
    console.log('\n🧪 Testing sendMessage API...');
    const response = await barkleClient.sendMessage('Testing bot functionality - notifications now enabled!', { visibility: 'public' });
    console.log('✅ Message sent successfully:', response);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error details:', error.stack);
  }
}

testBot();
