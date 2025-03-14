/**
 * Command Loading Analyzer and Fixer
 * Diagnoses and resolves command loading discrepancies
 */

const fs = require('fs').promises;
const path = require('path');

// Command tracking
const commandsById = {}; // Track commands by ID
const duplicateCommands = {}; // Track duplicates
const commandLocations = {}; // Track where commands are defined
const moduleStats = {}; // Stats for each module

// Helper functions
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function scanCommandsDirectory() {
  console.log('🔍 Scanning commands directory structure...\n');
  
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await analyzeDirectory(commandsDir);
  
  // Check for educational/commands.js issue
  const educationalDir = path.join(commandsDir, 'educational');
  const educationalCommandsFile = path.join(educationalDir, 'commands.js');
  const educationalMainFile = path.join(commandsDir, 'educational.js');
  
  if (await exists(educationalCommandsFile) && await exists(educationalMainFile)) {
    console.log('\n⚠️ Found potential issue: educational/commands.js and educational.js both exist');
    
    // Check educational.js content
    const mainContent = await fs.readFile(educationalMainFile, 'utf8');
    if (mainContent.includes('require(') || mainContent.includes('import ')) {
      console.log('  ✅ educational.js seems to import commands from educational/commands.js');
    } else {
      console.log('  ❌ educational.js does not seem to import commands from educational/commands.js');
      console.log('  💡 Suggested fix: Update educational.js to properly import from educational/commands.js');
    }
  }
  
  // Check index.js for loading duplicates
  const indexFile = path.join(commandsDir, 'index.js');
  if (await exists(indexFile)) {
    console.log('\n🔍 Checking command index.js file...');
    const indexContent = await fs.readFile(indexFile, 'utf8');
    
    // Check for duplicate requires
    const requireMatches = indexContent.match(/require\(['"]\.\/([^'"]+)['"]\)/g) || [];
    const requiredModules = requireMatches.map(match => {
      const moduleMatch = match.match(/require\(['"]\.\/([^'"]+)['"]\)/);
      return moduleMatch ? moduleMatch[1] : null;
    }).filter(Boolean);
    
    const moduleCounts = {};
    requiredModules.forEach(module => {
      moduleCounts[module] = (moduleCounts[module] || 0) + 1;
    });
    
    const duplicateModules = Object.entries(moduleCounts)
      .filter(([module, count]) => count > 1)
      .map(([module]) => module);
      
    if (duplicateModules.length > 0) {
      console.log(`  ❌ Found duplicate module imports in index.js: ${duplicateModules.join(', ')}`);
      console.log('  💡 Suggested fix: Remove duplicate requires in index.js');
    } else {
      console.log('  ✅ No duplicate module imports found in index.js');
    }
    
    // Check if all command files are imported
    const foundFiles = await findAllCommandFiles(commandsDir);
    const importedModules = new Set(requiredModules);
    
    const missingModules = foundFiles
      .filter(file => {
        const relativePath = path.relative(commandsDir, file);
        const moduleName = relativePath.replace(/\.js$/, '');
        return !importedModules.has(moduleName) && !relativePath.includes('/');
      })
      .map(file => path.basename(file, '.js'));
      
    if (missingModules.length > 0) {
      console.log(`  ❌ Found command files not imported in index.js: ${missingModules.join(', ')}`);
      console.log('  💡 Suggested fix: Add these modules to index.js');
    } else {
      console.log('  ✅ All command files appear to be properly imported in index.js');
    }
  }
  
  // Print out duplicates report
  console.log('\n📊 Duplicate Commands Report:');
  const duplicateIds = Object.keys(duplicateCommands);
  
  if (duplicateIds.length === 0) {
    console.log('  ✅ No duplicate commands found');
  } else {
    console.log(`  ❌ Found ${duplicateIds.length} duplicate commands:`);
    
    duplicateIds.forEach(id => {
      console.log(`\n  - Command: "${id}" appears in ${duplicateCommands[id].length} locations:`);
      duplicateCommands[id].forEach(location => {
        console.log(`    * ${location}`);
      });
    });
    
    console.log('\n  💡 Suggested fix: Consolidate duplicate commands into a shared utility');
  }
  
  // Print module stats summary
  console.log('\n📊 Module Commands Summary:');
  Object.keys(moduleStats).sort().forEach(module => {
    const stats = moduleStats[module];
    console.log(`  - ${module}: ${stats.commands} commands`);
  });
  
  // Total unique commands
  const uniqueCommands = Object.keys(commandsById).length;
  console.log(`\n📊 Total unique commands found: ${uniqueCommands}`);
  
  return {
    uniqueCommands,
    duplicates: duplicateIds.length,
    moduleStats
  };
}

async function findAllCommandFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      return findAllCommandFiles(fullPath);
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      return [fullPath];
    } else {
      return [];
    }
  }));
  
  return files.flat();
}

async function analyzeDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules
      if (entry.name !== 'node_modules') {
        await analyzeDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      await analyzeCommandFile(fullPath);
    }
  }
}

async function analyzeCommandFile(filePath) {
  try {
    // Load the module
    const moduleObj = require(filePath);
    const relativePath = path.relative(__dirname, filePath);
    const moduleName = path.basename(filePath, '.js');
    
    // Check module structure
    const hasCategory = typeof moduleObj.category === 'string';
    const hasCommands = typeof moduleObj.commands === 'object';
    
    // Determine category name
    let categoryName;
    if (hasCategory) {
      categoryName = moduleObj.category;
    } else {
      const dirName = path.basename(path.dirname(filePath));
      categoryName = dirName === 'commands' ? moduleName : dirName;
    }
    
    // Get command object
    const commands = hasCommands ? moduleObj.commands : moduleObj;
    
    // Count and record commands
    const commandCount = Object.keys(commands).filter(name => 
      typeof commands[name] === 'function' && name !== 'init'
    ).length;
    
    moduleStats[relativePath] = {
      name: moduleName,
      category: categoryName,
      commands: commandCount
    };
    
    // Record individual commands to find duplicates
    Object.keys(commands).forEach(commandName => {
      if (typeof commands[commandName] === 'function' && commandName !== 'init') {
        // Generate a unique ID for each command
        const commandId = commandName.toLowerCase();
        
        // Track command location
        const location = `${relativePath} (${categoryName})`;
        
        if (!commandsById[commandId]) {
          commandsById[commandId] = location;
          commandLocations[commandId] = [location];
        } else {
          // This is a duplicate
          if (!duplicateCommands[commandId]) {
            duplicateCommands[commandId] = [commandsById[commandId], location];
          } else {
            duplicateCommands[commandId].push(location);
          }
          commandLocations[commandId].push(location);
        }
      }
    });
    
    return {
      path: relativePath,
      name: moduleName,
      category: categoryName,
      commands: commandCount
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

async function fixEducationalModule() {
  console.log('\n🔧 Attempting to fix educational module...');
  
  const educationalDir = path.join(__dirname, 'src', 'commands');
  const mainFile = path.join(educationalDir, 'educational.js');
  const nestedFile = path.join(educationalDir, 'educational', 'commands.js');
  
  // Check if both files exist
  const mainExists = await exists(mainFile);
  const nestedExists = await exists(nestedFile);
  
  if (!mainExists || !nestedExists) {
    console.log('  ❌ Could not find educational module files');
    return false;
  }
  
  try {
    // Read main educational.js
    const mainContent = await fs.readFile(mainFile, 'utf8');
    
    // Check if it already imports commands
    if (mainContent.includes('require(\'./educational/commands\')') || 
        mainContent.includes('require("./educational/commands")') ||
        mainContent.includes('require(\'./educational/commands.js\')') ||
        mainContent.includes('require("./educational/commands.js")')) {
      console.log('  ✅ educational.js already imports commands correctly');
      return true;
    }
    
    // Create proper import content
    const fixedContent = `/**
 * Educational Commands for WhatsApp Bot
 * Access to educational tools and features
 */

const educationalCommands = require('./educational/commands');

// Export commands with category information
module.exports = {
  ...educationalCommands,
  category: 'educational'
};
`;

    // Backup original file
    await fs.writeFile(`${mainFile}.bak`, mainContent);
    console.log('  ✅ Created backup of educational.js');
    
    // Write fixed content
    await fs.writeFile(mainFile, fixedContent);
    console.log('  ✅ Updated educational.js to import commands properly');
    
    return true;
  } catch (error) {
    console.error('  ❌ Error fixing educational module:', error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Command Loading Analysis...');
  
  // Scan command directory structure
  await scanCommandsDirectory();
  
  // Offer to fix the educational module if needed
  const response = await askQuestion('Do you want to fix the educational module issue? (y/n) ');
  
  if (response.toLowerCase() === 'y') {
    await fixEducationalModule();
  }
  
  console.log('\n✅ Analysis complete');
}

// Helper to ask questions (simple implementation for demonstration)
function askQuestion(question) {
  return new Promise(resolve => {
    // In a real script we'd use readline, but for testing just resolve
    console.log(`${question} (Automatically answering 'y' for testing)`);
    setTimeout(() => resolve('y'), 500);
  });
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
});