/**
 * Command Duplication Detector
 * Detects actual command duplicates based on command registry
 */

const fs = require('fs').promises;
const path = require('path');

// Track results
const commandModules = new Map(); // Map of command names to modules that implement them
const results = {
  modulesAnalyzed: 0,
  commandsAnalyzed: 0,
  uniqueCommands: 0,
  duplicateCommands: 0,
  duplicates: []
};

// Keywords to ignore (not actual commands)
const ignoreKeywords = [
  'if', 'else', 'for', 'while', 'switch', 'case', 'default',
  'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue',
  'function', 'const', 'let', 'var', 'async', 'await', 'class',
  'get', 'set', 'new', 'this', 'super', 'import', 'export',
  'from', 'of', 'in', 'instanceof', 'typeof', 'void', 'delete',
  'then', 'true', 'false', 'null', 'undefined'
];

// Helper functions that aren't actual commands
const commonHelperFunctions = [
  'init', 'validateMention', 'getUserName', 'formatTime', 
  'formatDuration', 'parseDuration', 'ensureDirectory', 'containsLink',
  'containsToxicContent', 'isSpamming', 'handleWarning', 'getRandomElement',
  'drawPlaceholderAvatar', 'wrapText', 'initializeDirectories', 
  'initializeGameState', 'renderBoard', 'checkWinner', 'getBotMove',
  'findWinningMove', 'getHangmanDisplay', 'handleWordleGuess',
  'validateGifUrl', 'fetchApi', 'getFileTypeFromBuffer', 'detectFileTypeFromMagicNumbers',
  'initDirectories', 'isUserVerified', 'setUserVerification', 'isNsfwEnabledForGroup',
  'saveNsfwSettingsForGroup', 'downloadMedia', 'applyCooldown', 'getRemainingCooldown',
  'sendNsfwGif', 'areGamesEnabled', 'areMediaCommandsEnabled', 'safeFileOperation',
  'createMathChart'
];

async function detectDuplicateCommands() {
  console.log('🔍 Finding duplicate command implementations...\n');

  // Scan commands directory
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await processDirectory(commandsDir);

  // Calculate results
  results.uniqueCommands = commandModules.size;

  // Find duplicates
  for (const [commandName, modules] of commandModules.entries()) {
    if (modules.length > 1) {
      // This is a duplicate command
      results.duplicateCommands++;
      results.duplicates.push({
        command: commandName,
        modules: modules
      });
    }
  }

  // Sort duplicates by most problematic first (most implementations)
  results.duplicates.sort((a, b) => b.modules.length - a.modules.length);

  // Print summary
  console.log('\n📊 Command Duplication Analysis:');
  console.log(`  ✓ Total modules analyzed: ${results.modulesAnalyzed}`);
  console.log(`  ✓ Total commands analyzed: ${results.commandsAnalyzed}`);
  console.log(`  ✓ Unique command names: ${results.uniqueCommands}`);
  console.log(`  ⚠️ Duplicate commands: ${results.duplicateCommands}`);

  // Print detailed list of duplicates
  if (results.duplicates.length > 0) {
    console.log('\n🔄 Duplicate Commands (implemented in multiple modules):');
    for (const dup of results.duplicates) {
      console.log(`  • ${dup.command} (${dup.modules.length} implementations):`);
      for (const modInfo of dup.modules) {
        console.log(`    - ${modInfo.module} (${modInfo.file})`);
      }
      console.log('');
    }
  } else {
    console.log('\n✅ No duplicate commands found!');
  }

  // Print recommendations
  if (results.duplicates.length > 0) {
    console.log('\n💡 Recommendations:');
    console.log('  1. Consolidate duplicate commands into a common module or utility');
    console.log('  2. Ensure commands with the same name have consistent behavior');
    
    // Group by category for easier fixing
    const categoryDuplicates = {};
    for (const dup of results.duplicates) {
      for (const mod of dup.modules) {
        const category = mod.category || 'uncategorized';
        if (!categoryDuplicates[category]) {
          categoryDuplicates[category] = [];
        }
        if (!categoryDuplicates[category].includes(dup.command)) {
          categoryDuplicates[category].push(dup.command);
        }
      }
    }
    
    console.log('\n  Commands to consolidate by category:');
    for (const [category, commands] of Object.entries(categoryDuplicates)) {
      console.log(`  • ${category}: ${commands.join(', ')}`);
    }
  }

  console.log('\n✅ Command duplication analysis complete!');
  return results;
}

async function processDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules
        if (entry.name !== 'node_modules') {
          await processDirectory(fullPath);
        }
      } else if (entry.name.endsWith('.js') && !entry.name.startsWith('index.')) {
        await analyzeCommandModule(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing directory ${dir}:`, error.message);
  }
}

async function analyzeCommandModule(filePath) {
  try {
    console.log(`📄 Analyzing ${path.relative(__dirname, filePath)}`);
    results.modulesAnalyzed++;
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Get module info
    const fileName = path.basename(filePath);
    const moduleName = path.basename(filePath, '.js');
    const relativePath = path.relative(path.join(__dirname, 'src', 'commands'), filePath);
    
    // Determine the category
    let category = moduleName;
    const categoryMatch = content.match(/category:\s*['"]([^'"]+)['"]/);
    if (categoryMatch && categoryMatch[1]) {
      category = categoryMatch[1];
    }
    
    // Find command function definitions using a regular expression that targets function declarations
    const commandPattern = /(?:async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g;
    let match;
    
    // Also check for object property function definitions
    const objectMethodPattern = /([a-zA-Z0-9_]+):\s*(?:async\s+)?function\s*\([^)]*\)/g;
    
    // Process function declarations
    while ((match = commandPattern.exec(content)) !== null) {
      const commandName = match[1];
      processCommand(commandName, moduleName, relativePath, category);
    }
    
    // Process object method declarations
    while ((match = objectMethodPattern.exec(content)) !== null) {
      const commandName = match[1];
      processCommand(commandName, moduleName, relativePath, category);
    }
    
    // Also check for ES6 object method syntax
    const es6MethodPattern = /([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g;
    let insideCommandsObject = false;
    let commandsObjectStart = content.indexOf('commands: {');
    let commandsObjectEnd = -1;
    
    if (commandsObjectStart !== -1) {
      // Find the closing brace of the commands object
      let braceCount = 1;
      let pos = commandsObjectStart + 10; // Start after "commands: {"
      
      while (braceCount > 0 && pos < content.length) {
        if (content[pos] === '{') braceCount++;
        if (content[pos] === '}') braceCount--;
        pos++;
      }
      
      if (braceCount === 0) {
        commandsObjectEnd = pos;
        
        // Extract the commands object content
        const commandsObjectContent = content.substring(commandsObjectStart, commandsObjectEnd);
        
        // Find all method names within the commands object
        while ((match = es6MethodPattern.exec(commandsObjectContent)) !== null) {
          const commandName = match[1];
          processCommand(commandName, moduleName, relativePath, category);
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error analyzing ${filePath}:`, error.message);
  }
}

function processCommand(commandName, moduleName, filePath, category) {
  // Skip if this is a helper function or language keyword
  if (ignoreKeywords.includes(commandName) || commonHelperFunctions.includes(commandName)) {
    return;
  }
  
  results.commandsAnalyzed++;
  
  // Record this command implementation
  if (!commandModules.has(commandName)) {
    commandModules.set(commandName, []);
  }
  
  // Add this module to the list of modules implementing this command
  commandModules.get(commandName).push({
    module: moduleName,
    file: filePath,
    category: category
  });
}

// Run the analysis
detectDuplicateCommands().catch(error => {
  console.error('Error:', error);
});