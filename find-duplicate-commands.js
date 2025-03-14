/**
 * Find Duplicate Command Registrations
 * Helps identify commands that might be registered multiple times
 */

const fs = require('fs').promises;
const path = require('path');

// Store commands by name to find duplicates
const commandsMap = new Map();
// Track results
const results = {
  totalCommandsFound: 0,
  uniqueCommands: 0,
  duplicateCommands: 0,
  duplicates: []
};

async function loadCommands() {
  console.log('🔍 Finding duplicate command registrations...\n');
  
  // Scan main commands directory
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await processDirectory(commandsDir);
  
  // Analyze results
  results.uniqueCommands = commandsMap.size;
  
  // Find similar commands
  const similarCommands = findSimilarCommands([...commandsMap.keys()]);
  
  // Print summary
  console.log('\n📊 Command Duplication Analysis:');
  console.log(`  ✓ Total commands found: ${results.totalCommandsFound}`);
  console.log(`  ✓ Unique command names: ${results.uniqueCommands}`);
  console.log(`  ✗ Commands with duplicates: ${results.duplicateCommands}`);
  
  // Print duplicates
  if (results.duplicates.length > 0) {
    console.log('\n🚨 Duplicate Commands Detected:');
    
    // Group by command name
    const byCommand = {};
    results.duplicates.forEach(dup => {
      if (!byCommand[dup.command]) {
        byCommand[dup.command] = [];
      }
      byCommand[dup.command].push(dup.location);
    });
    
    // Print grouped by command
    for (const [command, locations] of Object.entries(byCommand)) {
      console.log(`  • ${command}:`);
      locations.forEach(loc => {
        console.log(`    - ${loc}`);
      });
    }
  }
  
  // Print similar commands if found
  if (similarCommands.length > 0) {
    console.log('\n⚠️ Potentially Similar Commands:');
    similarCommands.forEach(([cmd1, cmd2, similarity]) => {
      console.log(`  • "${cmd1}" and "${cmd2}" (${similarity}% similar)`);
    });
  }
  
  console.log('\n✅ Command duplication analysis complete!');
  
  return results;
}

async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules
      if (entry.name !== 'node_modules') {
        await processDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  try {
    console.log(`📄 Checking ${path.relative(__dirname, filePath)}`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Get module name
    const moduleName = path.basename(filePath, '.js');
    const relativePath = path.relative(path.join(__dirname, 'src', 'commands'), filePath);
    
    // Check modern format (with category and commands properties)
    const isModernFormat = content.includes('module.exports = {') && 
                          (content.includes('commands:') || content.includes('category:'));
    
    // Find all command functions
    let commandMatches;
    
    if (isModernFormat) {
      // Modern format with commands object
      commandMatches = content.match(/\s+(?:async\s+)?([a-zA-Z0-9_]+)(?:\s*\([^)]*\)\s*|\s*:\s*(?:async\s+)?function\s*\([^)]*\)\s*)\{[^}]*\}/g);
    } else {
      // Legacy format with direct exports
      commandMatches = content.match(/\s+(?:async\s+)?([a-zA-Z0-9_]+)(?:\s*:\s*(?:async\s+)?function\s*\([^)]*\)\s*|\s*\([^)]*\)\s*)\{[^}]*\}/g);
    }
    
    if (!commandMatches) {
      return;
    }
    
    // Extract command names
    for (const match of commandMatches) {
      const nameMatch = match.match(/\s+(?:async\s+)?([a-zA-Z0-9_]+)(?:\s*\(|\s*:)/);
      
      if (nameMatch && nameMatch[1] && nameMatch[1] !== 'init') {
        const commandName = nameMatch[1];
        results.totalCommandsFound++;
        
        // Check if command already exists
        if (commandsMap.has(commandName)) {
          results.duplicateCommands++;
          results.duplicates.push({
            command: commandName,
            location: relativePath,
            module: moduleName
          });
        } else {
          commandsMap.set(commandName, {
            location: relativePath,
            module: moduleName
          });
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error checking ${filePath}:`, error.message);
  }
}

function findSimilarCommands(commandList) {
  const similarCommands = [];
  const threshold = 80; // Similarity percentage threshold
  
  // Compare each command with every other command
  for (let i = 0; i < commandList.length; i++) {
    for (let j = i + 1; j < commandList.length; j++) {
      const cmd1 = commandList[i];
      const cmd2 = commandList[j];
      
      // Skip short commands which might naturally be similar
      if (cmd1.length < 4 || cmd2.length < 4) continue;
      
      // Calculate similarity percentage
      const similarity = calculateSimilarity(cmd1, cmd2);
      
      if (similarity >= threshold) {
        similarCommands.push([cmd1, cmd2, similarity]);
      }
    }
  }
  
  return similarCommands;
}

function calculateSimilarity(str1, str2) {
  // Levenshtein distance algorithm
  const track = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  
  // Calculate percentage similarity
  const maxLength = Math.max(str1.length, str2.length);
  const distance = track[str2.length][str1.length];
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

// Run the command finder
loadCommands().catch(error => {
  console.error('Error running finder:', error);
});