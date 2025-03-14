/**
 * Comprehensive Command Verification Tool
 * Validates all commands, their structure, and permissions
 */

const fs = require('fs').promises;
const path = require('path');

// Track command statistics
const stats = {
  totalCommands: 0,
  validCommands: 0,
  invalidCommands: 0,
  duplicateCommands: 0,
  commandsWithDescription: 0,
  commandsByCategory: {},
  commandsByPermission: {
    user: 0,
    admin: 0,
    owner: 0,
    nsfw: 0
  }
};

// Track issues
const issues = [];

// Duplicate tracking
const commandRegistry = {};

async function verifyCommands() {
  console.log('🔍 Starting comprehensive command verification...\n');
  
  // Scan command directory
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await scanDirectory(commandsDir);
  
  // Print summary
  console.log('\n📊 Command Verification Summary:');
  console.log(`  ✓ Total commands examined: ${stats.totalCommands}`);
  console.log(`  ✓ Valid commands: ${stats.validCommands}`);
  console.log(`  ✗ Invalid commands: ${stats.invalidCommands}`);
  console.log(`  ⚠ Duplicate commands: ${stats.duplicateCommands}`);
  console.log(`  ℹ Commands with descriptions: ${stats.commandsWithDescription}`);
  
  // Print category breakdown
  console.log('\n📋 Commands by category:');
  Object.entries(stats.commandsByCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  • ${category}: ${count} commands`);
    });
  
  // Print permission breakdown
  console.log('\n🔒 Commands by permission level:');
  console.log(`  • User-level: ${stats.commandsByPermission.user}`);
  console.log(`  • Admin-level: ${stats.commandsByPermission.admin}`);
  console.log(`  • Owner-level: ${stats.commandsByPermission.owner}`);
  console.log(`  • NSFW: ${stats.commandsByPermission.nsfw}`);
  
  // Print duplicate commands
  if (stats.duplicateCommands > 0) {
    console.log('\n⚠ Duplicate commands:');
    Object.entries(commandRegistry)
      .filter(([name, locations]) => locations.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([name, locations]) => {
        console.log(`  • "${name}" appears in ${locations.length} places:`);
        locations.forEach(location => {
          console.log(`    - ${location}`);
        });
      });
  }
  
  // Print identified issues
  if (issues.length > 0) {
    console.log('\n🐛 Identified issues:');
    issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  }
  
  console.log('\n✅ Command verification complete!');
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
      await verifyCommandFile(fullPath);
    }
  }
}

async function verifyCommandFile(filePath) {
  try {
    console.log(`📄 Verifying ${path.relative(__dirname, filePath)}`);
    
    // Load the module
    const module = require(filePath);
    
    // Get module name and category
    const fileName = path.basename(filePath, '.js');
    const dirName = path.basename(path.dirname(filePath));
    const category = dirName === 'commands' ? fileName : dirName;
    
    // Initialize category count
    if (!stats.commandsByCategory[category]) {
      stats.commandsByCategory[category] = 0;
    }
    
    // Check if module uses the modern format (with category and commands properties)
    const isModernFormat = module && typeof module === 'object' && 
                          (module.category || module.commands);
    
    let commands = {};
    
    if (isModernFormat && module.commands) {
      commands = module.commands;
    } else if (typeof module === 'object') {
      commands = module;
    } else {
      issues.push(`Invalid module format in ${filePath}`);
      return;
    }
    
    // Track command parameters and proper structure
    for (const [name, handler] of Object.entries(commands)) {
      // Skip init method
      if (name === 'init') continue;
      
      // Only process functions
      if (typeof handler !== 'function') continue;
      
      stats.totalCommands++;
      stats.commandsByCategory[category]++;
      
      // Register command for duplicate detection
      if (!commandRegistry[name]) {
        commandRegistry[name] = [];
      }
      commandRegistry[name].push(`${path.relative(__dirname, filePath)}`);
      
      // Check handler signature (should have at least sock and message parameters)
      const handlerStr = handler.toString();
      const paramMatch = handlerStr.match(/\(([^)]*)\)/);
      
      if (paramMatch) {
        const params = paramMatch[1].split(',').map(p => p.trim());
        
        if (params.length >= 2) {
          // Basic validation passed
          stats.validCommands++;
          
          // Check for description in comments
          if (handlerStr.includes('*') || handlerStr.includes('//')) {
            stats.commandsWithDescription++;
          }
          
          // Check permission level (basic heuristic)
          if (handlerStr.includes('isAdmin') || handlerStr.includes('groupAdmin')) {
            stats.commandsByPermission.admin++;
          } else if (handlerStr.includes('owner') || handlerStr.includes('isOwner')) {
            stats.commandsByPermission.owner++;
          } else if (handlerStr.includes('nsfw') || handlerStr.includes('NSFW')) {
            stats.commandsByPermission.nsfw++;
          } else {
            stats.commandsByPermission.user++;
          }
        } else {
          stats.invalidCommands++;
          issues.push(`Command "${name}" in ${fileName} has invalid parameter count: ${params.length}`);
        }
      } else {
        stats.invalidCommands++;
        issues.push(`Could not parse parameters for command "${name}" in ${fileName}`);
      }
    }
    
    // Check for duplicate commands
    Object.entries(commandRegistry)
      .filter(([name, locations]) => locations.length > 1)
      .forEach(([name]) => {
        stats.duplicateCommands++;
      });
  } catch (error) {
    console.error(`❌ Error verifying ${filePath}:`, error.message);
    issues.push(`Failed to load module ${filePath}: ${error.message}`);
  }
}

// Run the verification
verifyCommands().catch(error => {
  console.error('Error running verification:', error);
});