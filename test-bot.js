const { default: makeWASocket } = require('@whiskeysockets/baileys');
const { commandLoader } = require('./src/utils/commandLoader');

async function testBot() {
  try {
    console.log('Loading commands...');
    await commandLoader.loadCommandHandlers();
    console.log(`Successfully loaded ${commandLoader.commands.size} commands`);
    
    // Show a sample of available commands
    const allCommands = commandLoader.getAllCommands();
    console.log(`\nCommand sample (first 10):`);
    allCommands.slice(0, 10).forEach(cmd => {
      console.log(`- ${cmd.name} (${cmd.category}): ${cmd.config?.description || 'No description'}`);
    });
    
    console.log('\nTest complete!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testBot();