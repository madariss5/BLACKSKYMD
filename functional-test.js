/**
 * Functional Command Testing Tool for WhatsApp Bot
 * Tests the actual behavior of commands by simulating messages
 */

const fs = require('fs').promises;
const path = require('path');

// Mock sock object with tracking for sent messages
const createMockSock = () => {
  const sentMessages = [];
  const typingStates = [];
  
  return {
    // Track sent messages
    sendMessage: (jid, content, options = {}) => {
      sentMessages.push({ jid, content, options, timestamp: Date.now() });
      return Promise.resolve({ status: 1 });
    },
    // Track presence updates
    sendPresenceUpdate: (presence, jid) => {
      if (presence === 'composing') {
        typingStates.push({ jid, timestamp: Date.now() });
      }
      return Promise.resolve();
    },
    // For group related checks
    groupMetadata: (jid) => {
      return Promise.resolve({
        id: jid,
        subject: 'Test Group',
        participants: [
          { id: 'bot@s.whatsapp.net', admin: 'admin' },
          { id: 'user@s.whatsapp.net', admin: null },
          { id: 'admin@s.whatsapp.net', admin: 'admin' },
          { id: 'superadmin@s.whatsapp.net', admin: 'superadmin' }
        ],
        creation: Date.now(),
        desc: 'Test group description'
      });
    },
    // Allow command implementation to check if command is running in a group
    isJidGroup: (jid) => jid.endsWith('@g.us'),
    // Sent message tracking
    getSentMessages: () => sentMessages,
    getLastMessage: () => sentMessages[sentMessages.length - 1] || null,
    clearMessages: () => {
      sentMessages.length = 0;
    },
    // Typing state tracking
    getTypingStates: () => typingStates,
    wasTyping: () => typingStates.length > 0,
    clearTypingStates: () => {
      typingStates.length = 0;
    }
  };
};

// Create mock messages for testing
function createMockMessage(text, fromGroup = false, isAdmin = false) {
  const jid = fromGroup ? '123456789@g.us' : 'user@s.whatsapp.net';
  const sender = isAdmin ? 'admin@s.whatsapp.net' : 'user@s.whatsapp.net';
  
  return {
    key: {
      remoteJid: jid,
      fromMe: false,
      id: `MOCK${Date.now()}`
    },
    message: {
      conversation: text
    },
    messageTimestamp: Date.now() / 1000,
    participant: fromGroup ? sender : undefined,
    pushName: 'Test User',
    // Add attributes used by the handler
    body: text,
    sender,
    from: jid,
    isGroup: fromGroup
  };
}

// Load command modules
async function loadCommandModule(moduleName) {
  try {
    let modulePath;
    if (moduleName.includes('/')) {
      // For paths like educational/commands
      modulePath = path.join(__dirname, 'src', 'commands', `${moduleName}.js`);
    } else {
      modulePath = path.join(__dirname, 'src', 'commands', `${moduleName}.js`);
    }
    
    // Import the module
    const commandModule = require(modulePath);
    
    // Determine if it uses category pattern
    const hasCategory = !!commandModule.category;
    const hasCommands = !!commandModule.commands;
    
    // Get commands from the module
    const commands = hasCommands ? commandModule.commands : commandModule;
    
    // Get init function if exists
    const init = typeof commandModule.init === 'function' ? commandModule.init : null;
    
    return { commands, init, moduleName };
  } catch (error) {
    console.error(`Error loading module ${moduleName}:`, error.message);
    return null;
  }
}

// Find simple commands for testing
function findTestableCommands(commands) {
  const testable = [];
  
  Object.keys(commands).forEach(name => {
    if (typeof commands[name] === 'function' && name !== 'init') {
      // Get function parameters
      const funcStr = commands[name].toString();
      const paramMatch = funcStr.match(/\(([^)]*)\)/);
      const params = paramMatch 
        ? paramMatch[1].split(',').map(p => p.trim()).filter(p => p) 
        : [];
      
      // Check if the command is likely to be simple enough for testing
      // We want to avoid commands that may rely on specific environment
      const funcBody = funcStr.substring(funcStr.indexOf('{') + 1, funcStr.lastIndexOf('}'));
      
      const usesFileSystem = 
        funcBody.includes('fs.') || 
        funcBody.includes('writeFile') ||
        funcBody.includes('readFile');
        
      const requiresQuotedMsg = 
        funcBody.includes('quoted') || 
        funcBody.includes('quotedMsg');
        
      const requiresMedia = 
        funcBody.includes('downloadMedia') || 
        funcBody.includes('isImage') ||
        funcBody.includes('isVideo');
      
      // Only include commands that are likely to work with our mocks
      if (!requiresQuotedMsg && !requiresMedia && params.length <= 3) {
        testable.push({
          name,
          params,
          usesFileSystem
        });
      }
    }
  });
  
  return testable;
}

// Test a single command
async function testCommand(command, commands, sock) {
  console.log(`\n🧪 Testing command: ${command.name}`);
  
  try {
    // Reset tracking on sock mock
    sock.clearMessages();
    sock.clearTypingStates();
    
    // Create args based on command name (simple heuristic)
    let args = [];
    
    // Skip YouTube-related commands as they need real URLs
    if (command.name.includes('ytmp3') || command.name.includes('ytmp4') || command.name === 'play') {
      console.log(`  Skipping YouTube command: ${command.name}`);
      return {
        name: command.name,
        skipped: true,
        reason: 'YouTube command requires real URLs'
      };
    }
    
    // Customize arguments for different command types
    if (command.name.includes('translate')) args = ['hello', 'es'];
    else if (command.name.includes('calculate')) args = ['2+2'];
    else if (command.name.includes('weather')) args = ['New York'];
    else if (command.name.includes('define')) args = ['algorithm'];
    else if (command.name.includes('wiki')) args = ['computer'];
    else if (command.name.includes('search')) args = ['technology'];
    else if (command.name.includes('help')) args = [];
    else if (command.name.includes('language')) args = ['en'];
    else if (command.name.includes('currency')) args = ['100', 'USD', 'EUR'];
    else if (command.name.includes('dict')) args = ['test'];
    else if (command.name.includes('lyrics')) args = ['hello adele'];
    else args = ['test'];
    
    // Create test message for private chat
    const privateMsg = createMockMessage(`!${command.name} ${args.join(' ')}`.trim());
    
    // Try executing the command
    const result = await commands[command.name](sock, privateMsg, args);
    
    // Check if the command sent a message
    const lastMsg = sock.getLastMessage();
    const sentMessage = lastMsg ? true : false;
    const typingIndicator = sock.wasTyping();
    
    // Analyze response
    let responseType = 'none';
    if (lastMsg) {
      const content = lastMsg.content;
      
      if (content.image) responseType = 'image';
      else if (content.video) responseType = 'video';
      else if (content.audio) responseType = 'audio';
      else if (content.sticker) responseType = 'sticker';
      else if (content.document) responseType = 'document';
      else responseType = 'text';
    }
    
    // Log test results
    console.log(`  Response: ${sentMessage ? '✅' : '❌'} (${responseType})`);
    console.log(`  Typing: ${typingIndicator ? '✅' : '❌'}`);
    
    // Return test result
    return {
      name: command.name,
      success: sentMessage,
      responseType,
      showedTyping: typingIndicator,
    };
  } catch (error) {
    console.error(`  Error testing ${command.name}:`, error.message);
    return {
      name: command.name,
      success: false,
      error: error.message
    };
  }
}

// Run tests for a module
async function testModule(moduleName) {
  console.log(`\n📋 Testing module: ${moduleName}`);
  
  // Load module
  const module = await loadCommandModule(moduleName);
  if (!module) return { moduleName, error: 'Failed to load module' };
  
  // Create mock sock
  const sock = createMockSock();
  
  // Initialize if needed
  if (module.init) {
    try {
      console.log('  Initializing module...');
      await module.init(sock);
      console.log('  ✅ Initialization successful');
    } catch (error) {
      console.error('  ❌ Initialization failed:', error.message);
      return { 
        moduleName, 
        initialized: false,
        error: `Init failed: ${error.message}`
      };
    }
  }
  
  // Find testable commands
  const testableCommands = findTestableCommands(module.commands);
  console.log(`  Found ${testableCommands.length} testable commands`);
  
  // Cap the number of commands to test (to keep runtime reasonable)
  const commandsToTest = testableCommands.slice(0, 5);
  
  // Test commands
  const results = [];
  for (const command of commandsToTest) {
    const result = await testCommand(command, module.commands, sock);
    results.push(result);
  }
  
  // Calculate success rate
  const successCount = results.filter(r => r.success).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const failCount = results.length - successCount - skippedCount;
  const testedCount = results.length - skippedCount;
  
  console.log(`\n  Results for ${moduleName}:`);
  console.log(`  ✅ Successful: ${successCount}/${testedCount} ${skippedCount > 0 ? `(${skippedCount} skipped)` : ''}`);
  console.log(`  ❌ Failed: ${failCount}/${testedCount}`);
  
  return {
    moduleName,
    initialized: true,
    commandsTested: results.length,
    testedCount,
    successCount,
    failCount,
    skippedCount,
    results
  };
}

// Main test function
async function runTests() {
  // Define modules to test
  const modulesToTest = [
    'basic',
    'fun',
    'media',
    'utility'
  ];
  
  console.log('🚀 Starting functional command tests...');
  
  const results = [];
  for (const moduleName of modulesToTest) {
    const result = await testModule(moduleName);
    results.push(result);
  }
  
  // Print summary
  console.log('\n📊 Test Summary:');
  
  let totalTested = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  
  results.forEach(module => {
    if (module.error) {
      console.log(`❌ ${module.moduleName}: Failed to test - ${module.error}`);
    } else {
      totalTested += module.testedCount || 0;
      totalSuccess += module.successCount || 0;
      totalSkipped += module.skippedCount || 0;
      
      console.log(`${module.moduleName}: ${module.successCount}/${module.testedCount} commands passed ${module.skippedCount > 0 ? `(${module.skippedCount} skipped)` : ''}`);
    }
  });
  
  console.log(`\n📋 Overall: ${totalSuccess}/${totalTested} passed (${totalSkipped} skipped)`);
  console.log(`📋 Success rate: ${Math.round((totalSuccess / totalTested) * 100)}%`);
}

// Run the tests
runTests().catch(error => {
  console.error('Test runner error:', error);
});