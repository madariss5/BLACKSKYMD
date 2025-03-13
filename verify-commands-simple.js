/**
 * Simple Command Verification Script
 * Tests all handlers with a basic mock connection
 */

// Import handlers - from most complex to simplest
const ultraMinimalHandler = require('./src/handlers/ultra-minimal-handler');
const simpleHandler = require('./src/handlers/simpleMessageHandler');
const minimalHandler = require('./src/handlers/minimalHandler');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Create a mock socket object
const mockSock = {
  sendMessage: async (jid, content) => {
    console.log(`[MOCK] Message sent to ${jid}:`);
    console.log(JSON.stringify(content, null, 2));
    return {
      status: 1,
      message: 'Mock message sent'
    };
  }
};

// Create a mock message
const createMockMessage = (text, jid = '123456789@s.whatsapp.net') => {
  return {
    key: {
      remoteJid: jid,
      fromMe: false,
      id: 'mock-message-id'
    },
    message: {
      conversation: text
    }
  };
};

// Test a handler with basic commands
async function testHandler(handler, name) {
  console.log(`\n${colors.bright}${colors.blue}=== Testing ${name} Handler ===\n${colors.reset}`);
  
  try {
    // Initialize the handler
    const initialized = await handler.init();
    
    if (!initialized) {
      console.log(`${colors.red}❌ Failed to initialize handler${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✅ Handler initialized${colors.reset}`);
    
    // Test basic commands
    const commands = [
      '!ping',
      '!help',
      '!status'
    ];
    
    for (const command of commands) {
      console.log(`\n${colors.yellow}Testing command: ${command}${colors.reset}`);
      const mockMessage = createMockMessage(command);
      
      try {
        // Process the message
        await handler.messageHandler(mockSock, mockMessage);
        console.log(`${colors.green}✅ Command ${command} executed successfully${colors.reset}`);
      } catch (err) {
        console.log(`${colors.red}❌ Command ${command} failed: ${err.message}${colors.reset}`);
        console.error(err.stack);
      }
    }
    
    // Try an invalid command to test error handling
    console.log(`\n${colors.yellow}Testing invalid command: !invalidcommandtest${colors.reset}`);
    const invalidMockMessage = createMockMessage('!invalidcommandtest');
    
    try {
      // This should not crash
      await handler.messageHandler(mockSock, invalidMockMessage);
      console.log(`${colors.green}✅ Invalid command handled gracefully${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}❌ Invalid command caused error: ${err.message}${colors.reset}`);
      console.error(err.stack);
      return false;
    }
    
    console.log(`\n${colors.green}✅ All tests passed for ${name} handler${colors.reset}`);
    return true;
  } catch (err) {
    console.log(`${colors.red}❌ Error during ${name} handler testing: ${err.message}${colors.reset}`);
    console.error(err.stack);
    return false;
  }
}

// Verify all handlers
async function verifyCommands() {
  console.log(`${colors.bright}${colors.blue}=== WhatsApp Bot Handlers Verification ===\n${colors.reset}`);
  
  // Test each handler
  const handlers = [
    { handler: ultraMinimalHandler, name: 'Ultra Minimal' },
    { handler: simpleHandler, name: 'Simple' },
    { handler: minimalHandler, name: 'Minimal' }
  ];
  
  let successCount = 0;
  
  for (const { handler, name } of handlers) {
    const success = await testHandler(handler, name);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\n${colors.bright}${colors.blue}=== Verification Summary ===\n${colors.reset}`);
  console.log(`${colors.cyan}Total handlers tested: ${handlers.length}${colors.reset}`);
  console.log(`${colors.green}✅ Successfully verified: ${successCount}${colors.reset}`);
  
  if (successCount === handlers.length) {
    console.log(`\n${colors.bright}${colors.green}All handlers verified successfully!${colors.reset}`);
    return true;
  } else {
    console.log(`\n${colors.bright}${colors.red}Some handlers failed verification.${colors.reset}`);
    return false;
  }
}

// Run the verification
verifyCommands().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});