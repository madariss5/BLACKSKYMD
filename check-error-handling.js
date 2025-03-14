/**
 * Command Error Handling Checker
 * Analyzes command modules for proper error handling patterns
 */

const fs = require('fs').promises;
const path = require('path');

// Track results
const results = {
  modulesChecked: 0,
  commandsChecked: 0,
  commandsWithTryCatch: 0,
  commandsWithErrorReport: 0,
  commandsWithoutErrorHandling: [],
  moduleStats: {},
  recommendedFixes: []
};

// Critical commands that must have error handling
const criticalCommands = [
  'kick', 'add', 'promote', 'demote', 'ban', 'unban',
  'shutdown', 'restart', 'maintenance', 'setprefix',
  'play', 'ytmp3', 'ytmp4', 'sticker'
];

async function checkErrorHandling() {
  console.log('🔍 Starting error handling pattern analysis...\n');
  
  // Scan main commands directory
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await scanDirectory(commandsDir);
  
  // Analyze patterns and generate recommendations
  generateRecommendations();
  
  // Print summary
  console.log('\n📊 Error Handling Analysis Summary:');
  console.log(`  ✓ Total modules checked: ${results.modulesChecked}`);
  console.log(`  ✓ Total commands checked: ${results.commandsChecked}`);
  console.log(`  ✓ Commands with try/catch: ${results.commandsWithTryCatch} (${Math.round(results.commandsWithTryCatch / results.commandsChecked * 100)}%)`);
  console.log(`  ✓ Commands with error reporting: ${results.commandsWithErrorReport} (${Math.round(results.commandsWithErrorReport / results.commandsChecked * 100)}%)`);
  console.log(`  ✗ Commands without proper error handling: ${results.commandsWithoutErrorHandling.length}`);
  
  // Print commands without error handling
  if (results.commandsWithoutErrorHandling.length > 0) {
    console.log('\n⚠️ Commands without proper error handling:');
    
    // Group by module
    const byModule = {};
    results.commandsWithoutErrorHandling.forEach(cmd => {
      if (!byModule[cmd.module]) {
        byModule[cmd.module] = [];
      }
      byModule[cmd.module].push(cmd.command);
    });
    
    // Print grouped by module
    for (const [module, commands] of Object.entries(byModule)) {
      console.log(`  • ${module}: ${commands.join(', ')}`);
    }
  }
  
  // Print critical commands without error handling
  const criticalWithoutHandling = results.commandsWithoutErrorHandling.filter(
    cmd => criticalCommands.includes(cmd.command)
  );
  
  if (criticalWithoutHandling.length > 0) {
    console.log('\n🚨 CRITICAL COMMANDS without proper error handling:');
    criticalWithoutHandling.forEach(cmd => {
      console.log(`  • ${cmd.module}.${cmd.command}`);
    });
  }
  
  // Print recommendations
  if (results.recommendedFixes.length > 0) {
    console.log('\n💡 Recommended fixes:');
    results.recommendedFixes.forEach((fix, index) => {
      console.log(`  ${index + 1}. ${fix}`);
    });
  }
  
  console.log('\n✅ Error handling analysis complete!');
  
  return results;
}

function generateRecommendations() {
  // Generate recommendations based on analysis
  
  // 1. Check if central error handler exists
  let hasErrorUtility = false;
  try {
    const errorPath = path.join(__dirname, 'src', 'utils', 'error.js');
    if (fs.existsSync(errorPath)) {
      hasErrorUtility = true;
    }
  } catch (err) {
    // Ignore error
  }
  
  if (!hasErrorUtility) {
    results.recommendedFixes.push(
      'Create a central error handling utility in src/utils/error.js'
    );
  }
  
  // 2. Recommend adding error handling to critical commands
  const criticalWithoutHandling = results.commandsWithoutErrorHandling.filter(
    cmd => criticalCommands.includes(cmd.command)
  );
  
  if (criticalWithoutHandling.length > 0) {
    results.recommendedFixes.push(
      `Add try/catch blocks to ${criticalWithoutHandling.length} critical commands`
    );
  }
  
  // 3. Check if modules have low error handling coverage
  const modulesCoverage = {};
  
  for (const [moduleName, stats] of Object.entries(results.moduleStats)) {
    const coverage = (stats.withErrorHandling / stats.totalCommands) * 100;
    modulesCoverage[moduleName] = coverage;
    
    if (coverage < 50 && stats.totalCommands > 3) {
      results.recommendedFixes.push(
        `Improve error handling in ${moduleName} module (only ${Math.round(coverage)}% coverage)`
      );
    }
  }
  
  // 4. Check for inconsistent error handling patterns
  const hasMultiplePatterns = results.commandsWithTryCatch > 0 && 
                            (results.commandsWithTryCatch < results.commandsWithErrorReport);
  
  if (hasMultiplePatterns) {
    results.recommendedFixes.push(
      'Standardize error handling approach across all commands'
    );
  }
}

async function scanDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules
      if (entry.name !== 'node_modules') {
        await scanDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      await checkCommandFile(fullPath);
    }
  }
}

async function checkCommandFile(filePath) {
  try {
    console.log(`📄 Checking ${path.relative(__dirname, filePath)}`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Get module name
    const fileName = path.basename(filePath, '.js');
    results.modulesChecked++;
    
    // Initialize module stats
    results.moduleStats[fileName] = {
      totalCommands: 0,
      withErrorHandling: 0,
      criticalCommands: 0
    };
    
    // Check for global error handling pattern in the file
    const hasGlobalHandler = content.includes('try {') && content.includes('catch (');
    
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
      console.log(`  ⚠️ No command functions found in ${fileName}`);
      return;
    }
    
    // Analyze each command function
    for (const match of commandMatches) {
      // Extract command name
      const nameMatch = match.match(/\s+(?:async\s+)?([a-zA-Z0-9_]+)(?:\s*\(|\s*:)/);
      
      if (nameMatch && nameMatch[1] && nameMatch[1] !== 'init') {
        const commandName = nameMatch[1];
        results.commandsChecked++;
        results.moduleStats[fileName].totalCommands++;
        
        // Check if it's a critical command
        if (criticalCommands.includes(commandName)) {
          results.moduleStats[fileName].criticalCommands++;
        }
        
        // Check for error handling patterns
        const hasTryCatch = match.includes('try {') && match.includes('catch (');
        const hasErrorReporting = match.includes('error') && 
                               (match.includes('report') || match.includes('log') || match.includes('throw'));
        
        if (hasTryCatch) {
          results.commandsWithTryCatch++;
          results.moduleStats[fileName].withErrorHandling++;
        }
        
        if (hasErrorReporting) {
          results.commandsWithErrorReport++;
          
          // If it has error reporting but not try/catch, count it as having error handling
          if (!hasTryCatch) {
            results.moduleStats[fileName].withErrorHandling++;
          }
        }
        
        // Check if there's no error handling
        if (!hasTryCatch && !hasErrorReporting && !hasGlobalHandler) {
          results.commandsWithoutErrorHandling.push({
            module: fileName,
            command: commandName,
            isCritical: criticalCommands.includes(commandName)
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error checking ${filePath}:`, error.message);
  }
}

// Run the error handling check
checkErrorHandling().catch(error => {
  console.error('Error running check:', error);
});