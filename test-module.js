/**
 * Test a specific command module
 */

const path = require('path');

// Get module name from argument
const moduleName = process.argv[2];
if (!moduleName) {
  console.error('Please provide a module name (e.g., basic, fun, media)');
  process.exit(1);
}

// Get the module path
let modulePath;
if (moduleName.includes('/')) {
  // For paths like educational/commands
  modulePath = path.join(__dirname, 'src', 'commands', `${moduleName}.js`);
} else {
  modulePath = path.join(__dirname, 'src', 'commands', `${moduleName}.js`);
}

async function testModule(modulePath) {
  console.log(`🔍 Testing module: ${modulePath}`);
  
  try {
    // Import the command module
    const commandModule = require(modulePath);
    
    // Check module structure
    console.log('📋 Module exports:');
    Object.keys(commandModule).forEach(key => {
      const type = typeof commandModule[key];
      console.log(`  - ${key}: ${type}`);
    });
    
    // Determine if it uses category pattern
    const hasCategory = !!commandModule.category;
    const hasCommands = !!commandModule.commands;
    const hasInit = typeof commandModule.init === 'function';
    
    console.log(`\n📋 Module type: ${hasCategory ? 'Categorized' : 'Direct exports'}`);
    console.log(`📋 Has init function: ${hasInit ? 'Yes' : 'No'}`);
    
    // Get commands from the module
    const commands = hasCommands ? commandModule.commands : commandModule;
    
    // List commands and their structure
    console.log('\n📋 Commands:');
    
    Object.keys(commands).filter(key => typeof commands[key] === 'function' && key !== 'init').forEach(cmdName => {
      const command = commands[cmdName];
      
      // Get function parameters
      const funcStr = command.toString();
      const paramMatch = funcStr.match(/\(([^)]*)\)/);
      const params = paramMatch ? paramMatch[1].split(',').map(p => p.trim()).filter(p => p) : [];
      
      console.log(`  - ${cmdName}:`);
      console.log(`    Parameters: ${params.join(', ')}`);
      
      // Extract important functional parts
      const funcBody = funcStr.substring(funcStr.indexOf('{') + 1, funcStr.lastIndexOf('}'));
      
      // Check for key API usages
      const usesDatabase = funcBody.includes('getGroupSettings') || funcBody.includes('getUserProfile');
      const sendsMedia = funcBody.includes('sendImage') || funcBody.includes('sendVideo') || funcBody.includes('sendAudio');
      const usesExternalAPI = funcBody.includes('axios.get') || funcBody.includes('fetch(');
      
      console.log(`    Uses database: ${usesDatabase ? 'Yes' : 'No'}`);
      console.log(`    Sends media: ${sendsMedia ? 'Yes' : 'No'}`);
      console.log(`    Uses external API: ${usesExternalAPI ? 'Yes' : 'No'}`);
    });
    
    // Try initialization if available
    if (hasInit) {
      console.log('\n📋 Attempting initialization...');
      try {
        const mockSock = { sendMessage: () => Promise.resolve() };
        const initResult = await commandModule.init(mockSock);
        console.log(`    Result: ${initResult ? 'Success' : 'No result'}`);
      } catch (error) {
        console.error(`    Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error testing module: ${error.message}`);
  }
}

testModule(modulePath).catch(error => {
  console.error('Testing error:', error);
});