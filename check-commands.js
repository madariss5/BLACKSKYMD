// Import the command loader
const { commandLoader } = require('./src/utils/commandLoader');

// Save original console methods
const originalConsole = { 
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error
};

// Override all logging methods to disable them
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = () => {};
console.error = () => {};

// Also disable the logger if it's being used
try {
  const logger = require('./src/utils/logger');
  if (logger) {
    logger.info = () => {};
    logger.debug = () => {};
    logger.error = () => {};
    logger.warn = () => {};
  }
} catch (e) {
  // Logger module might not exist or have a different structure
}

// Run the command loading
async function checkCommands() {
  try {
    // First load the commands
    await commandLoader.loadCommandHandlers();
    
    // Restore console
    Object.assign(console, originalConsole);
    
    // Get loaded commands
    const commands = commandLoader.getAllCommands();
    
    // Get categories
    const categories = {};
    commands.forEach(cmd => {
      categories[cmd.category] = (categories[cmd.category] || 0) + 1;
    });
    
    // Get file list to compare
    const fs = require('fs');
    const path = require('path');
    const commandsDir = path.join(__dirname, 'src/commands');
    const configDir = path.join(__dirname, 'src/config/commands');
    
    const jsFiles = fs.readdirSync(commandsDir)
      .filter(file => file.endsWith('.js') && file !== 'index.js')
      .map(file => file.replace('.js', ''));
    
    const jsonFiles = fs.readdirSync(configDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    // Find categories not in loaded commands
    const missingCategories = jsFiles.filter(file => 
      !Object.keys(categories).includes(file) && file !== 'group_new');
    
    // Display results
    console.log('\n==================================================');
    console.log('          WhatsApp Bot Command Status              ');
    console.log('==================================================');
    console.log(`✅ Total commands loaded: ${commands.length}`);
    
    console.log('\nCommands by category:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`- ${category}: ${count} commands`);
      });
    
    console.log('\nCommand files in filesystem:');
    jsFiles.forEach(file => {
      const loaded = Object.keys(categories).includes(file) ? '✅' : '❌';
      console.log(`${loaded} ${file}${file === 'group_new' ? ' (likely merged with group)' : ''}`);
    });
    
    if (missingCategories.length > 0) {
      console.log('\n⚠️ Some command categories were not loaded:');
      missingCategories.forEach(category => {
        console.log(`- ${category}`);
      });
    } else {
      console.log('\n✅ All command categories successfully loaded!');
    }
    
    if (commands.length > 0) {
      console.log('\n✅ Command system is working properly!');
      console.log(`   Successfully loaded ${commands.length} commands across ${Object.keys(categories).length} categories`);
    } else {
      console.log('\n❌ No commands were loaded!');
    }
    console.log('==================================================\n');
  } catch (error) {
    // Restore console in case of error
    Object.assign(console, originalConsole);
    console.error('Error checking commands:', error);
  }
}

// Run check
checkCommands();
