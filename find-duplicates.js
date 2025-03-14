/**
 * Find Duplicate Command Registrations
 * Helps identify commands that might be registered multiple times
 */

const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const readline = require('readline');

// Track commands and their locations
const commands = {};
const commandsDir = path.join(__dirname, 'src', 'commands');

async function loadCommands() {
  console.log('🔍 Searching for command definitions in src/commands...\n');
  
  // Process the commands directory
  await processDirectory(commandsDir);
  
  // Find commands with multiple registrations
  findSimilarCommands(commands);
}

async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      // Process subdirectories
      await processDirectory(fullPath);
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      // Process JavaScript files
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  try {
    console.log(`📄 Processing ${path.relative(__dirname, filePath)}`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Determine if this is a modern or legacy format command file
    const isModernFormat = content.includes('module.exports = {') && 
                          (content.includes('commands:') || content.includes('category:'));
    
    // Get file name without extension for category
    const fileName = path.basename(filePath, '.js');
    const category = path.relative(commandsDir, path.dirname(filePath)) || fileName;
    
    // For modern format, extract commands from the commands object
    if (isModernFormat) {
      // Try to match commands definition
      const commandsMatch = content.match(/commands\s*:\s*{([^}]+)}/s);
      
      if (commandsMatch) {
        const commandsBlock = commandsMatch[1];
        const commandLines = commandsBlock.split('\n');
        
        for (const line of commandLines) {
          // Match command name definitions (async function or regular function)
          const matches = line.match(/\s*(async\s+)?([a-zA-Z0-9_]+)\s*\(/);
          
          if (matches && matches[2] && matches[2] !== 'function') {
            const commandName = matches[2];
            
            if (!commands[commandName]) {
              commands[commandName] = [];
            }
            
            commands[commandName].push({
              file: path.relative(__dirname, filePath),
              category
            });
          }
        }
      }
    } else {
      // Legacy format, look for direct method definitions
      const methodMatches = content.match(/(async\s+)?([a-zA-Z0-9_]+)\s*:\s*(async\s+)?\s*function\s*\(/g);
      
      if (methodMatches) {
        for (const match of methodMatches) {
          const nameMatch = match.match(/(async\s+)?([a-zA-Z0-9_]+)\s*:/);
          
          if (nameMatch && nameMatch[2] && nameMatch[2] !== 'init') {
            const commandName = nameMatch[2];
            
            if (!commands[commandName]) {
              commands[commandName] = [];
            }
            
            commands[commandName].push({
              file: path.relative(__dirname, filePath),
              category
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

function findSimilarCommands(commandList) {
  const duplicates = [];
  
  // Filter commands that appear in multiple files
  for (const [command, locations] of Object.entries(commandList)) {
    if (locations.length > 1) {
      duplicates.push({
        command,
        locations
      });
    }
  }
  
  // Sort duplicates by number of occurrences
  duplicates.sort((a, b) => b.locations.length - a.locations.length);
  
  // Print duplicate commands
  if (duplicates.length > 0) {
    console.log(`\n⚠️ Found ${duplicates.length} commands registered in multiple files:\n`);
    
    for (const { command, locations } of duplicates) {
      console.log(`Command: "${command}" appears in ${locations.length} files:`);
      
      for (const location of locations) {
        console.log(`  - ${location.file} (category: ${location.category})`);
      }
      
      console.log(''); // Add empty line for spacing
    }
    
    // Suggest resolution
    console.log('💡 Suggested Resolution:');
    console.log('1. Keep the most comprehensive implementation');
    console.log('2. Remove or rename duplicate implementations');
    console.log('3. Consider creating shared utility functions for common functionality');
  } else {
    console.log('\n✅ No duplicate command registrations found!');
  }
  
  // Print command statistics
  const totalCommands = Object.keys(commandList).length;
  console.log(`\n📊 Total unique commands found: ${totalCommands}`);
}

// Run the command finder
loadCommands().catch(error => {
  console.error('Error:', error);
});