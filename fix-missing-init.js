/**
 * Fix Missing init() Functions
 * Adds missing init() functions to command modules
 */

const fs = require('fs').promises;
const path = require('path');

// Track results
const results = {
  modulesChecked: 0,
  modulesWithInit: 0,
  modulesWithoutInit: 0,
  modulesFailed: 0,
  modulesFixed: 0
};

async function fixMissingInitFunction() {
  console.log('🔧 Starting to check and fix missing init() functions...\n');
  
  // Scan main commands directory
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await scanDirectory(commandsDir);
  
  // Print summary
  console.log('\n📊 Summary of initialization function check:');
  console.log(`  ✓ Total modules checked: ${results.modulesChecked}`);
  console.log(`  ✓ Modules with init function: ${results.modulesWithInit}`);
  console.log(`  ✗ Modules without init function: ${results.modulesWithoutInit}`);
  console.log(`  ✅ Modules fixed: ${results.modulesFixed}`);
  console.log(`  ❌ Modules failed: ${results.modulesFailed}`);
  
  console.log('\n✅ Initialization function check and fix complete!');
  
  return results;
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
      await checkAndFixCommandFile(fullPath);
    }
  }
}

async function checkAndFixCommandFile(filePath) {
  try {
    console.log(`📄 Checking ${path.relative(__dirname, filePath)}`);
    results.modulesChecked++;
    
    // Read file content
    let content = await fs.readFile(filePath, 'utf8');
    
    // Check if init function exists
    const hasInit = content.includes('async init(') || 
                  content.includes('async function init(') ||
                  content.includes('init: async function') ||
                  content.includes('init: function');
    
    if (hasInit) {
      console.log(`  ✓ Module has init function`);
      results.modulesWithInit++;
      return;
    }
    
    console.log(`  ✗ Module missing init function`);
    results.modulesWithoutInit++;
    
    // Determine module format (modern or legacy)
    const isModernFormat = content.includes('module.exports = {') && 
                          (content.includes('commands:') || content.includes('category:'));
    
    // Create a template init function
    const fileName = path.basename(filePath);
    const moduleName = path.basename(filePath, '.js');
    
    let initFunction = '';
    if (isModernFormat) {
      // Check if commands object already has a trailing comma before the closing brace
      if (content.includes('commands: {')) {
        // Find the position of the closing brace of the commands object
        const commandsClosingBracePos = content.lastIndexOf('}', content.lastIndexOf('};'));
        
        // Check if there's a comma before the closing brace
        const hasTrailingComma = /,\s*}/.test(content.substring(commandsClosingBracePos - 10, commandsClosingBracePos + 1));
        
        // Add init to the commands object
        if (hasTrailingComma) {
          initFunction = `
  // Module initialization
  async init(sock) {
    console.log(\`Initializing ${moduleName} module...\`);
    
    // Add any necessary setup here
    
    return true; // Return true to indicate successful initialization
  }`;
        } else {
          initFunction = `
  // Module initialization
  async init(sock) {
    console.log(\`Initializing ${moduleName} module...\`);
    
    // Add any necessary setup here
    
    return true; // Return true to indicate successful initialization
  },`;
        }
        
        // Insert init function into the commands object
        content = content.replace(/}(\s*)\}\s*;?\s*$/, `${initFunction}$1}$1};`);
      } else {
        console.log(`  ⚠️ Could not locate commands object in modern format module`);
        results.modulesFailed++;
        return;
      }
    } else {
      // Legacy format (direct export as object)
      initFunction = `
  // Module initialization
  async init(sock) {
    console.log(\`Initializing ${moduleName} module...\`);
    
    // Add any necessary setup here
    
    return true; // Return true to indicate successful initialization
  },`;
      
      // Add init function to the module object
      // Look for the last function in the object
      const objectEndPos = content.lastIndexOf('};');
      if (objectEndPos !== -1) {
        // Check if there's a comma before the closing brace
        const lastMethodEnd = content.lastIndexOf('},', objectEndPos);
        const textBeforeEnd = content.substring(lastMethodEnd, objectEndPos).trim();
        
        if (textBeforeEnd === '},') {
          // Already has trailing comma after last method
          content = content.substring(0, objectEndPos) + initFunction + content.substring(objectEndPos);
        } else {
          // Needs comma after last method
          content = content.substring(0, objectEndPos) + ',' + initFunction + content.substring(objectEndPos);
        }
      } else {
        console.log(`  ⚠️ Could not locate module object end in legacy format module`);
        results.modulesFailed++;
        return;
      }
    }
    
    // Create backup of original file
    await fs.writeFile(`${filePath}.bak`, await fs.readFile(filePath));
    console.log(`  ✓ Created backup of original file: ${path.basename(filePath)}.bak`);
    
    // Write updated content
    await fs.writeFile(filePath, content);
    console.log(`  ✅ Added init function to ${path.basename(filePath)}`);
    results.modulesFixed++;
    
  } catch (error) {
    console.error(`  ❌ Error checking/fixing ${filePath}:`, error.message);
    results.modulesFailed++;
  }
}

// Run the fix function
fixMissingInitFunction().catch(error => {
  console.error('Error running fix:', error);
});