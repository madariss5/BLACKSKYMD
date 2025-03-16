/**
 * Check Reaction Commands Script
 * This script will check the available reaction commands in the commands/reactions.js file
 */

const fs = require('fs');
const path = require('path');

// Path to the reactions.js file
const reactionsPath = path.join(__dirname, 'src', 'commands', 'reactions.js');

try {
  // Read the file
  const reactionsFile = fs.readFileSync(reactionsPath, 'utf8');
  
  // Parse the commands from the file
  const commandsMatch = reactionsFile.match(/const commands = \{([^}]+)\}/s);
  
  if (commandsMatch && commandsMatch[1]) {
    const commandsText = commandsMatch[1];
    const commandList = commandsText.split(',\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cmdMatch = line.match(/^\s*(\w+):/);
        return cmdMatch ? cmdMatch[1] : null;
      })
      .filter(cmd => cmd !== null);
    
    console.log('== Reaction Commands ==');
    console.log(commandList.join(', '));
    console.log(`Total commands: ${commandList.length}`);
    
    // Check for 'kill' command specifically
    if (commandList.includes('kill')) {
      console.log('\n✅ The "kill" command is properly defined in reactions.js');
    } else {
      console.log('\n❌ The "kill" command is NOT found in reactions.js');
    }
    
    // Check if the GIF file exists
    const gifPath = path.join(__dirname, 'data', 'reaction_gifs', 'kill.gif');
    if (fs.existsSync(gifPath)) {
      const stats = fs.statSync(gifPath);
      console.log(`\n✅ kill.gif exists (${stats.size} bytes)`);
    } else {
      console.log('\n❌ kill.gif does NOT exist in the reactions directory');
    }
    
  } else {
    console.log('Could not find commands object in reactions.js');
  }
} catch (error) {
  console.error('Error reading or parsing reactions.js:', error);
}