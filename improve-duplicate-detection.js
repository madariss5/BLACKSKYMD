/**
 * Improved Duplicate Command Detection
 * Analyzes commands across modules to identify true duplicate implementations
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const commandsDir = path.join(__dirname, 'src', 'commands');
const outputFile = path.join(__dirname, 'duplicate-commands-report.md');

// Track command implementations
const commands = new Map();
const stats = {
  modules: 0,
  commandsAnalyzed: 0,
  similarGroups: 0,
  duplicatePairs: 0
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
  'formatDuration', 'parseDuration', 'areGamesEnabled', 'ensureDirectory'
];

async function findDuplicates() {
  console.log('🔍 Finding duplicate command implementations...');
  
  // Scan commands directory
  await processDirectory(commandsDir);
  
  // Find similar command names (possibly typos or naming inconsistencies)
  const similarCommandNames = findSimilarCommandNames(Array.from(commands.keys()));
  
  // Generate report
  const report = generateReport(similarCommandNames);
  
  // Save report
  await fs.writeFile(outputFile, report);
  console.log(`✅ Report saved to ${outputFile}`);
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log(`  Modules analyzed: ${stats.modules}`);
  console.log(`  Commands analyzed: ${stats.commandsAnalyzed}`);
  console.log(`  Similar command groups: ${stats.similarGroups}`);
  console.log(`  Potential duplicate pairs: ${stats.duplicatePairs}`);
}

async function processDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively process subdirectories
        await processDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        // Skip index.js files
        if (entry.name === 'index.js') continue;
        
        // Process command file
        await analyzeCommandFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error);
  }
}

async function analyzeCommandFile(filePath) {
  try {
    stats.modules++;
    console.log(`Analyzing ${path.relative(__dirname, filePath)}`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract module name
    const moduleName = path.basename(filePath, '.js');
    
    // Find both function-style and object-style command definitions
    
    // Function style: async commandName(sock, message, args) {...}
    const functionPattern = /(?:async\s+)?([a-zA-Z0-9_]+)\s*\(\s*(?:sock|socket|client|bot|conn|connection)(?:\s*,\s*(?:m|msg|message|context|event))(?:\s*,\s*(?:args|arguments|params|parameters))?\s*\)\s*(?:=>)?\s*\{/g;
    
    // Object method style: commandName: async function(sock, message, args) {...}
    const objectMethodPattern = /([a-zA-Z0-9_]+)\s*:\s*(?:async\s+)?function\s*\(\s*(?:sock|socket|client|bot|conn|connection)(?:\s*,\s*(?:m|msg|message|context|event))(?:\s*,\s*(?:args|arguments|params|parameters))?\s*\)/g;
    
    // ES6 object method style: commandName(sock, message, args) {...}
    const es6MethodPattern = /([a-zA-Z0-9_]+)\s*\(\s*(?:sock|socket|client|bot|conn|connection)(?:\s*,\s*(?:m|msg|message|context|event))(?:\s*,\s*(?:args|arguments|params|parameters))?\s*\)\s*\{/g;
    
    let match;
    const fileCommands = new Set();
    
    // Process function declarations
    while ((match = functionPattern.exec(content)) !== null) {
      const commandName = match[1];
      if (shouldProcessCommand(commandName)) {
        registerCommand(commandName, moduleName, filePath);
        fileCommands.add(commandName);
      }
    }
    
    // Process object method declarations
    while ((match = objectMethodPattern.exec(content)) !== null) {
      const commandName = match[1];
      if (shouldProcessCommand(commandName)) {
        registerCommand(commandName, moduleName, filePath);
        fileCommands.add(commandName);
      }
    }
    
    // Process ES6 object methods
    while ((match = es6MethodPattern.exec(content)) !== null) {
      const commandName = match[1];
      if (shouldProcessCommand(commandName) && !fileCommands.has(commandName)) {
        registerCommand(commandName, moduleName, filePath);
        fileCommands.add(commandName);
      }
    }
    
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
  }
}

function shouldProcessCommand(commandName) {
  return (
    !ignoreKeywords.includes(commandName) && 
    !commonHelperFunctions.includes(commandName) &&
    !commandName.startsWith('_') &&
    commandName.length > 1
  );
}

function registerCommand(commandName, moduleName, filePath) {
  stats.commandsAnalyzed++;
  
  if (!commands.has(commandName)) {
    commands.set(commandName, []);
  }
  
  commands.get(commandName).push({
    module: moduleName,
    path: path.relative(__dirname, filePath),
    code: null // We could store code blocks for deeper analysis if needed
  });
}

function findSimilarCommandNames(commandNames) {
  const similarGroups = [];
  
  // Sort commands by name for easier analysis
  const sortedNames = [...commandNames].sort();
  
  // Find similar names based on string similarity
  for (let i = 0; i < sortedNames.length; i++) {
    const current = sortedNames[i];
    const similars = [current];
    
    for (let j = 0; j < sortedNames.length; j++) {
      if (i === j) continue;
      
      const other = sortedNames[j];
      const similarity = calculateStringSimilarity(current, other);
      
      // If similarity is high but not identical
      if (similarity > 0.8 && similarity < 1) {
        similars.push(other);
      }
    }
    
    // If we found similar commands
    if (similars.length > 1) {
      // Check if this group overlaps with an existing group
      const overlapsWithExisting = similarGroups.some(group => 
        group.some(cmd => similars.includes(cmd))
      );
      
      if (!overlapsWithExisting) {
        similarGroups.push(similars);
        stats.similarGroups++;
        stats.duplicatePairs += (similars.length * (similars.length - 1)) / 2; // n choose 2
      }
    }
  }
  
  return similarGroups;
}

function calculateStringSimilarity(str1, str2) {
  // Simple Levenshtein distance implementation
  const track = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j++) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const distance = track[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);
  
  return maxLength > 0 ? 1 - distance / maxLength : 1;
}

function generateReport(similarCommandNames) {
  let report = `# Command Duplication Analysis Report\n\n`;
  report += `*Generated on ${new Date().toLocaleString()}*\n\n`;
  
  // Add summary statistics
  report += `## Summary\n\n`;
  report += `- **Modules analyzed:** ${stats.modules}\n`;
  report += `- **Commands analyzed:** ${stats.commandsAnalyzed}\n`;
  report += `- **Commands with multiple implementations:** ${Array.from(commands.entries()).filter(([_, impls]) => impls.length > 1).length}\n`;
  report += `- **Similar command name groups:** ${stats.similarGroups}\n`;
  report += `- **Potential duplicate implementations:** ${stats.duplicatePairs}\n\n`;
  
  // Report commands with multiple implementations
  report += `## Commands with Multiple Implementations\n\n`;
  
  const multipleImplementations = Array.from(commands.entries())
    .filter(([_, impls]) => impls.length > 1)
    .sort((a, b) => b[1].length - a[1].length); // Sort by number of implementations
  
  if (multipleImplementations.length > 0) {
    for (const [commandName, implementations] of multipleImplementations) {
      report += `### \`${commandName}\` (${implementations.length} implementations)\n\n`;
      
      for (const impl of implementations) {
        report += `- Module: **${impl.module}** (${impl.path})\n`;
      }
      
      report += `\n**Recommendation:** Consolidate implementations or rename to reflect different purposes.\n\n`;
    }
  } else {
    report += `No commands with multiple implementations found.\n\n`;
  }
  
  // Report similar command names
  report += `## Similar Command Names\n\n`;
  
  if (similarCommandNames.length > 0) {
    for (let i = 0; i < similarCommandNames.length; i++) {
      const group = similarCommandNames[i];
      report += `### Group ${i + 1}\n\n`;
      
      for (const commandName of group) {
        const implementations = commands.get(commandName);
        report += `- \`${commandName}\` - ${implementations.length} implementation(s):\n`;
        
        for (const impl of implementations) {
          report += `  - Module: **${impl.module}** (${impl.path})\n`;
        }
      }
      
      report += `\n**Recommendation:** Standardize naming or ensure distinct functionality is clear.\n\n`;
    }
  } else {
    report += `No similar command names found.\n\n`;
  }
  
  // Add recommendations section
  report += `## Recommendations\n\n`;
  report += `1. **Consolidate duplicate implementations** into utility modules\n`;
  report += `2. **Standardize naming conventions** across modules\n`;
  report += `3. **Document intentional duplicates** with clear comments\n`;
  report += `4. **Implement centralized error handling** for all commands\n`;
  
  return report;
}

// Run the analysis
findDuplicates().catch(err => {
  console.error('Error:', err);
});