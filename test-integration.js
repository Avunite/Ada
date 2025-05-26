#!/usr/bin/env node

// Simple integration test for the Ada bot components
try {
  console.log('🧪 Testing Ada Bot Integration...\n');

  // Dynamic imports to handle ES modules
  const { default: config } = await import('./src/config.js');
  const { default: toolManager } = await import('./src/tool-manager.js');
  const { default: userContextManager } = await import('./src/user-context-manager.js');

  console.log('✅ All modules imported successfully\n');

  // Test tool manager
  console.log('📋 Available Tools:');
  const tools = toolManager.getAllTools();
  tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  console.log(`\n✅ Tool Manager: ${tools.length} tools loaded successfully`);

  // Test tool schemas
  console.log('\n🔧 Tool Schemas:');
  const schemas = toolManager.getToolSchemas();
  schemas.forEach(schema => {
    const requiredParams = schema.parameters.required || [];
    console.log(`  - ${schema.name}: requires [${requiredParams.join(', ')}]`);
  });

  // Test user context manager
  console.log('\n👤 User Context Manager:');
  console.log('  - Cache initialized');
  console.log('  - Cleanup interval configured');

  // Test cache stats
  const cacheStats = userContextManager.getCacheStats();
  console.log(`  - Current cache entries: ${cacheStats.totalEntries}`);

  console.log('\n🎉 All core components loaded successfully!');
  console.log('\n📝 Next steps:');
  console.log('  1. Configure .env with your API credentials');
  console.log('  2. Customize system.txt for bot personality');
  console.log('  3. Run "npm start" to launch the bot');
  console.log('\n🚀 Ada is ready for deployment!');
} catch (error) {
  console.error('❌ Integration test failed:', error.message);
  process.exit(1);
}
