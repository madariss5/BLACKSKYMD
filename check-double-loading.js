/**
 * Double Loading Checker
 * Identifies if commands are being loaded multiple times through different paths
 */

const fs = require('fs').promises;
const path = require('path');

// Global tracking
const commandTracker = {};
const modulePaths = {};
const moduleCommands = {};
const directoryStructure = {};

async function scanProject() {
  console.log('🔍 Scanning project for command loading issues...\n');
  
  // Find key files
  const srcDir = path.join(__dirname, 'src');
  const commandsDir = path.join(srcDir, 'commands');
  const indexJs = path.join(commandsDir, 'index.js');
  
  // Map directory structure
  await mapDirectory(srcDir);
  
  console.log('📂 Command Directory Structure:');
  printDirectoryStructure(directoryStructure, '');
  
  // Analyze index.js
  console.log('\n📄 Analyzing commands/index.js...');
  const indexContent = await fs.readFile(indexJs, 'utf8');
  
  // Look for requires
  const requirePattern = /require\(['"](\.\/[^'"]+)['"]\)/g;
  let match;
  const importedModules = [];
  
  while ((match = requirePattern.exec(indexContent)) !== null) {
    const modulePath = match[1];
    importedModules.push(modulePath);
    console.log(`  ↪ Import: ${modulePath}`);
  }
  
  // Look for modules with submodules
  for (const moduleName in moduleCommands) {
    if (moduleName.includes('/')) {
      const parentModule = moduleName.split('/')[0];
      console.log(`\n⚠️ Found nested module: ${moduleName} (parent: ${parentModule})`);
      
      // Check if both parent and child are loaded
      if (importedModules.includes(`./${parentModule}`) && !indexContent.includes(`// Skip ${parentModule}`)) {
        console.log(`  ❌ Potential double loading: Both ${parentModule} and ${moduleName} may be loaded`);
        console.log(`  💡 Suggestion: Add comment "// Skip ${parentModule}" before the require if it's intentionally empty`);
      }
    }
  }
  
  // Check for command overlaps
  console.log('\n🔄 Checking for command overlaps...');
  const commandDuplicates = {};
  
  for (const commandName in commandTracker) {
    const paths = commandTracker[commandName];
    if (paths.length > 1) {
      commandDuplicates[commandName] = paths;
    }
  }
  
  if (Object.keys(commandDuplicates).length > 0) {
    console.log(`  ❌ Found ${Object.keys(commandDuplicates).length} commands defined in multiple places:`);
    
    for (const commandName in commandDuplicates) {
      console.log(`\n  - "${commandName}" defined in:`);
      for (const location of commandDuplicates[commandName]) {
        console.log(`    * ${location}`);
      }
    }
  } else {
    console.log('  ✅ No command overlaps found');
  }
  
  // Check for double loading with same module path
  console.log('\n🔄 Checking for redundant module loading...');
  
  const occurringModules = {};
  for (const modulePath in modulePaths) {
    const locations = modulePaths[modulePath];
    if (locations.length > 1) {
      occurringModules[modulePath] = locations;
    }
  }
  
  if (Object.keys(occurringModules).length > 0) {
    console.log(`  ❌ Found ${Object.keys(occurringModules).length} modules loaded from multiple places:`);
    
    for (const modulePath in occurringModules) {
      console.log(`\n  - "${modulePath}" loaded in:`);
      for (const location of occurringModules[modulePath]) {
        console.log(`    * ${location}`);
      }
    }
  } else {
    console.log('  ✅ No redundant module loading found');
  }
  
  // Check index.js direct export
  if (indexContent.includes('module.exports = {')) {
    console.log('\n⚠️ index.js directly exports commands');
    const exportPattern = /module\.exports\s*=\s*{\s*([^}]+)\s*}/s;
    const exportMatch = exportPattern.exec(indexContent);
    
    if (exportMatch) {
      const exportContent = exportMatch[1];
      const commandNames = exportContent.split(',')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));
      
      console.log(`  ℹ️ Direct exports: ${commandNames.length} potential commands`);
    }
  }
  
  // Find initializeModules in index.js
  if (indexContent.includes('initializeModules') || indexContent.includes('initializeCommands')) {
    console.log('\n✅ index.js uses initialization function to load commands');
  }
  
  // Print summary
  console.log('\n📊 Command Loading Summary:');
  console.log(`  ➡️ Total command modules found: ${Object.keys(moduleCommands).length}`);
  
  let totalCommands = 0;
  let duplicateCount = 0;
  
  for (const moduleName in moduleCommands) {
    const commands = moduleCommands[moduleName];
    totalCommands += commands.length;
    console.log(`  ➡️ ${moduleName}: ${commands.length} commands`);
  }
  
  for (const commandName in commandTracker) {
    if (commandTracker[commandName].length > 1) {
      duplicateCount++;
    }
  }
  
  console.log(`\n  ➡️ Total unique commands: ${Object.keys(commandTracker).length}`);
  console.log(`  ➡️ Total command definitions: ${totalCommands}`);
  console.log(`  ➡️ Duplicate commands: ${duplicateCount}`);
  
  const discrepancy = totalCommands - Object.keys(commandTracker).length;
  console.log(`  ➡️ Loading discrepancy: ${discrepancy} extra command loads`);
  
  if (discrepancy > 0) {
    console.log('\n🔍 Likely cause of command count discrepancy:');
    console.log('  1. Commands defined in multiple modules (confirmed above)');
    console.log('  2. Nested modules like educational/commands.js being loaded directly and through parent');
    console.log('  3. Index.js importing a module multiple times');
    
    if (Object.keys(commandDuplicates).length > 0) {
      console.log('\n💡 Resolution recommendation:');
      console.log('  1. Consolidate duplicate commands into single implementations');
      console.log('  2. Ensure nested modules (like educational/commands.js) are only loaded once');
      console.log('  3. Add comments in index.js for modules that are intentionally empty shells');
    }
  }
}

async function mapDirectory(dir, relativeBase = '') {
  // Read directory
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  // Initialize directory in structure
  const relativePath = path.relative(__dirname, dir);
  const dirName = path.basename(dir);
  
  // Get reference to current directory in structure
  let currentDir = directoryStructure;
  
  // If this is a subdirectory, navigate the structure
  if (relativePath && relativePath !== '.') {
    const parts = relativePath.split(path.sep);
    
    for (const part of parts) {
      if (!currentDir[part]) {
        currentDir[part] = {};
      }
      currentDir = currentDir[part];
    }
  }
  
  // Process entries
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Skip node_modules and other non-relevant dirs
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        await mapDirectory(path.join(dir, entry.name), path.join(relativeBase, entry.name));
      }
    } else if (entry.name.endsWith('.js')) {
      // Record file in directory structure
      currentDir[entry.name] = 'file';
      
      // Skip non-command files
      if (entry.name === 'index.js' || !relativePath.includes('commands')) {
        continue;
      }
      
      // Extract command module information
      const filePath = path.join(dir, entry.name);
      await analyzeCommandFile(filePath);
    }
  }
}

async function analyzeCommandFile(filePath) {
  try {
    // Get module name from path
    const relativePath = path.relative(__dirname, filePath);
    const moduleName = relativePath.replace(/^src\/commands\//, '')
                                    .replace(/\.js$/, '');
    
    // Skip index files
    if (moduleName === 'index') return;
    
    // Try to load the module
    const module = require(filePath);
    
    // Track module paths
    if (!modulePaths[moduleName]) {
      modulePaths[moduleName] = [];
    }
    modulePaths[moduleName].push(relativePath);
    
    // Initialize module commands array
    if (!moduleCommands[moduleName]) {
      moduleCommands[moduleName] = [];
    }
    
    // Get commands object
    let commands = module;
    if (module.commands && typeof module.commands === 'object') {
      commands = module.commands;
    }
    
    // Scan commands
    for (const commandName in commands) {
      if (typeof commands[commandName] === 'function' && commandName !== 'init') {
        // Add to module commands
        moduleCommands[moduleName].push(commandName);
        
        // Track command definitions
        if (!commandTracker[commandName]) {
          commandTracker[commandName] = [];
        }
        commandTracker[commandName].push(moduleName);
      }
    }
  } catch (error) {
    console.log(`  ⚠️ Could not analyze ${filePath}: ${error.message}`);
  }
}

function printDirectoryStructure(dir, indent = '') {
  for (const name in dir) {
    if (dir[name] === 'file') {
      console.log(`${indent}📄 ${name}`);
    } else {
      console.log(`${indent}📁 ${name}`);
      printDirectoryStructure(dir[name], indent + '  ');
    }
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Double Loading Check...');
  await scanProject();
  console.log('\n✅ Analysis complete');
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
});