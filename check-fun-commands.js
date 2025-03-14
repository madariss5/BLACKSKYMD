/**
 * Script to check if the new fun commands are properly loaded
 */

// Load the fun module
const funModule = require('./src/commands/fun.js');

console.log('✅ Checking fun module commands...');
console.log(`Total commands in fun module: ${Object.keys(funModule.commands).length}`);

// Check for specific new commands
const commandsToCheck = ['slot', 'fortune', 'horoscope', 'yomama'];

// Check if these commands exist
commandsToCheck.forEach(cmd => {
  if (funModule.commands[cmd]) {
    console.log(`✅ Command '${cmd}' is implemented`);
  } else {
    console.log(`❌ Command '${cmd}' is NOT implemented`);
  }
});

// List all available commands
console.log('\nAll available commands in fun module:');
console.log(Object.keys(funModule.commands).join(', '));

// Check if config file is updated
const fs = require('fs');
try {
  const funConfig = JSON.parse(fs.readFileSync('./src/config/commands/fun.json', 'utf8'));
  console.log(`\nCommands in fun.json config: ${funConfig.commands.length}`);
  
  // Check for specific commands in config
  commandsToCheck.forEach(cmd => {
    const found = funConfig.commands.find(c => c.name === cmd);
    if (found) {
      console.log(`✅ Command '${cmd}' is in config file`);
    } else {
      console.log(`❌ Command '${cmd}' is NOT in config file`);
    }
  });
} catch (err) {
  console.error('Error reading config file:', err.message);
}