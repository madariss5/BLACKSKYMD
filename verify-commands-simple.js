/**
 * Simple Command Verification Tool 
 * This script just checks if commands are being loaded correctly
 */

// Suppress all console output during command loading
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = function() {};
console.info = function() {};
console.debug = function() {};
console.warn = function() {};
console.error = function() {};

// Import the commandLoader
const { commandLoader } = require('./src/utils/commandLoader');
const fs = require('fs').promises;
const path = require('path');

// Restore console functions for our output
setTimeout(() => {
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  
  // Now run our verification
  verifyCommands();
}, 100);

async function verifyCommands() {
  try {
    console.log("\n==== WhatsApp Bot Command Loading Verification ====\n");
    
    // Load commands
    console.log("Loading commands...");
    await commandLoader.loadCommandHandlers();
    
    // Get all loaded commands
    const commands = commandLoader.getAllCommands();
    console.log(`Total commands loaded: ${commands.length}`);
    
    // Check for specific categories
    const categories = {};
    for (const cmd of commands) {
      categories[cmd.category] = (categories[cmd.category] || 0) + 1;
    }
    
    console.log("\nCommands by category:");
    for (const [category, count] of Object.entries(categories)) {
      console.log(`- ${category}: ${count} commands`);
    }
    
    // Count how many command JS files we have
    const commandsDir = path.join(__dirname, 'src/commands');
    const files = await fs.readdir(commandsDir);
    const jsFiles = files.filter(file => file.endsWith('.js') && file !== 'index.js');
    
    console.log(`\nFound ${jsFiles.length} command module files (excluding index.js)`);
    
    // Check config dir
    const configDir = path.join(__dirname, 'src/config/commands');
    const configFiles = await fs.readdir(configDir);
    const jsonFiles = configFiles.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} command configuration files\n`);
    
    // Overall status
    if (commands.length > 0) {
      console.log("✅ Commands are being loaded successfully!");
      console.log(`✅ ${commands.length} commands are available to use\n`);
    } else {
      console.log("❌ No commands were loaded!\n");
    }
    
    console.log("==== Verification Complete ====\n");
    
  } catch (err) {
    console.error("Error during verification:", err);
  }
}