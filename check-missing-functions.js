/**
 * Command Function Coverage Checker
 * Identifies missing or inconsistent functions across command modules
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const requiredFunctions = {
  all: ['init'], // Functions all command modules should have
  specific: {
    // Category-specific required functions
    'basic': ['help', 'ping', 'info', 'status'],
    'media': ['sticker', 'toimg'],
    'group': ['kick', 'add', 'promote', 'demote'],
    'owner': ['restart', 'shutdown', 'setprefix'],
    'user': ['profile', 'register'],
    'fun': ['joke', 'quote', 'meme']
  },
  recommended: ['help', 'about'] // Recommended functions
};

// Track results
const results = {
  modulesChecked: 0,
  missingRequired: [],
  missingRecommended: [],
  moduleStats: {},
  categoryStats: {},
  consistencyIssues: []
};

async function checkMissingFunctions() {
  console.log('🔍 Starting command function coverage check...\n');
  
  // Scan main commands directory
  const commandsDir = path.join(__dirname, 'src', 'commands');
  await scanDirectory(commandsDir);
  
  // Analyze function patterns
  analyzePatterns();
  
  // Print summary
  console.log('\n📊 Command Function Coverage Summary:');
  console.log(`  ✓ Total modules checked: ${results.modulesChecked}`);
  
  // Print missing required functions
  if (results.missingRequired.length > 0) {
    console.log('\n❌ Modules missing required functions:');
    results.missingRequired.forEach(item => {
      console.log(`  • ${item.module}: Missing ${item.function}`);
    });
  } else {
    console.log('\n✅ All modules contain required functions');
  }
  
  // Print missing recommended functions
  if (results.missingRecommended.length > 0) {
    console.log('\n⚠️ Modules missing recommended functions:');
    results.missingRecommended.forEach(item => {
      console.log(`  • ${item.module}: Could add ${item.function}`);
    });
  }
  
  // Print function distribution by category
  console.log('\n📋 Function distribution by category:');
  for (const [category, funcs] of Object.entries(results.categoryStats)) {
    console.log(`  • ${category}:`);
    
    // Sort functions by frequency
    const sortedFuncs = Object.entries(funcs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 functions
    
    sortedFuncs.forEach(([func, count]) => {
      console.log(`    - ${func}: ${count} modules`);
    });
    
    if (Object.keys(funcs).length > 10) {
      console.log(`    - ... and ${Object.keys(funcs).length - 10} more functions`);
    }
  }
  
  // Print consistency issues
  if (results.consistencyIssues.length > 0) {
    console.log('\n⚠️ Potential consistency issues:');
    results.consistencyIssues.forEach(issue => {
      console.log(`  • ${issue}`);
    });
  }
  
  console.log('\n✅ Command function coverage check complete!');
  
  return results;
}

function analyzePatterns() {
  // Look for function naming patterns across modules
  const functionCounts = {};
  
  // Aggregate all functions
  for (const moduleStats of Object.values(results.moduleStats)) {
    for (const func of moduleStats.functions) {
      functionCounts[func] = (functionCounts[func] || 0) + 1;
    }
  }
  
  // Check for similarly named functions (potential typos or inconsistencies)
  const similarFunctions = {};
  
  Object.keys(functionCounts).forEach(func1 => {
    Object.keys(functionCounts).forEach(func2 => {
      if (func1 !== func2 && areSimilar(func1, func2)) {
        if (!similarFunctions[func1]) {
          similarFunctions[func1] = new Set();
        }
        similarFunctions[func1].add(func2);
      }
    });
  });
  
  // Report similar functions as potential issues
  for (const [func, similars] of Object.entries(similarFunctions)) {
    if (similars.size > 0) {
      const similarList = Array.from(similars).join(', ');
      results.consistencyIssues.push(
        `Function "${func}" is similar to: ${similarList}. Consider standardizing names.`
      );
    }
  }
  
  // Check for prefix/suffix patterns
  const prefixPatterns = {};
  const suffixPatterns = {};
  
  Object.keys(functionCounts).forEach(func => {
    // Check for common prefixes (get*, set*, show*, etc.)
    const prefixMatch = func.match(/^([a-z]+)[A-Z]/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      if (!prefixPatterns[prefix]) {
        prefixPatterns[prefix] = 0;
      }
      prefixPatterns[prefix]++;
    }
    
    // Check for common suffixes (*Info, *Data, *Command, etc.)
    const suffixMatch = func.match(/[a-z]([A-Z][a-z]+)$/);
    if (suffixMatch) {
      const suffix = suffixMatch[1].toLowerCase();
      if (!suffixPatterns[suffix]) {
        suffixPatterns[suffix] = 0;
      }
      suffixPatterns[suffix]++;
    }
  });
  
  // Report inconsistent usage of prefixes/suffixes
  for (const [prefix, count] of Object.entries(prefixPatterns)) {
    if (count >= 3) { // At least 3 functions with this prefix
      // Check if similar functions exist without this prefix
      const prefixRegex = new RegExp('^' + prefix + '([A-Z][a-z]+)$', 'i');
      const unprefixedVariants = [];
      
      Object.keys(functionCounts).forEach(func => {
        const match = func.match(prefixRegex);
        if (match) {
          const unprefixed = match[1].toLowerCase();
          if (functionCounts[unprefixed]) {
            unprefixedVariants.push(`${func} vs ${unprefixed}`);
          }
        }
      });
      
      if (unprefixedVariants.length > 0) {
        results.consistencyIssues.push(
          `Inconsistent prefix usage for "${prefix}": ${unprefixedVariants.join(', ')}`
        );
      }
    }
  }
}

function areSimilar(str1, str2) {
  // Simple check for typos: strings differ by only 1-2 characters
  if (Math.abs(str1.length - str2.length) > 2) return false;
  
  // Check edit distance
  const distance = levenshteinDistance(str1, str2);
  return distance > 0 && distance <= 2;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
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
    
    // Load the module
    const module = require(filePath);
    
    // Get module name and category
    const fileName = path.basename(filePath, '.js');
    const dirName = path.basename(path.dirname(filePath));
    const category = dirName === 'commands' ? fileName : dirName;
    
    // Initialize category stats
    if (!results.categoryStats[category]) {
      results.categoryStats[category] = {};
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
      console.error(`❌ Invalid module format in ${filePath}`);
      return;
    }
    
    // Track module and its functions
    results.modulesChecked++;
    
    const functions = Object.keys(commands).filter(name => 
      typeof commands[name] === 'function'
    );
    
    results.moduleStats[fileName] = {
      category,
      functions,
      path: filePath
    };
    
    // Update category stats
    functions.forEach(func => {
      if (!results.categoryStats[category][func]) {
        results.categoryStats[category][func] = 0;
      }
      results.categoryStats[category][func]++;
    });
    
    // Check for required functions
    requiredFunctions.all.forEach(func => {
      if (!functions.includes(func)) {
        results.missingRequired.push({
          module: fileName,
          function: func,
          category
        });
      }
    });
    
    // Check for category-specific required functions
    if (requiredFunctions.specific[category]) {
      requiredFunctions.specific[category].forEach(func => {
        if (!functions.includes(func)) {
          results.missingRequired.push({
            module: fileName,
            function: func,
            category
          });
        }
      });
    }
    
    // Check for recommended functions
    requiredFunctions.recommended.forEach(func => {
      if (!functions.includes(func)) {
        results.missingRecommended.push({
          module: fileName,
          function: func,
          category
        });
      }
    });
    
    // Check for consistent command handling patterns
    const commandPatterns = {
      hasErrorHandling: false,
      hasCooldown: false,
      hasPermissionCheck: false,
      hasValidation: false
    };
    
    // Analyze function implementations for important patterns
    for (const [name, handler] of Object.entries(commands)) {
      if (typeof handler !== 'function') continue;
      
      const handlerStr = handler.toString();
      
      // Check for try/catch blocks (error handling)
      if (handlerStr.includes('try') && handlerStr.includes('catch')) {
        commandPatterns.hasErrorHandling = true;
      }
      
      // Check for cooldown mechanism
      if (handlerStr.includes('cooldown') || handlerStr.includes('rateLimit') || handlerStr.includes('throttle')) {
        commandPatterns.hasCooldown = true;
      }
      
      // Check for permission checks
      if (handlerStr.includes('isAdmin') || handlerStr.includes('permissions') || 
          handlerStr.includes('isOwner') || handlerStr.includes('hasPermission')) {
        commandPatterns.hasPermissionCheck = true;
      }
      
      // Check for input validation
      if (handlerStr.includes('validate') || handlerStr.includes('if (!') || 
          handlerStr.includes('if (!')  || handlerStr.includes('typeof')) {
        commandPatterns.hasValidation = true;
      }
    }
    
    // Report on missing safety patterns
    if (!commandPatterns.hasErrorHandling) {
      results.consistencyIssues.push(`${fileName}: No error handling detected`);
    }
    
    if (!commandPatterns.hasValidation && functions.length > 2) {
      results.consistencyIssues.push(`${fileName}: No input validation detected`);
    }
    
    // Check specific categories that should have certain safety features
    if ((category === 'group' || category === 'owner') && !commandPatterns.hasPermissionCheck) {
      results.consistencyIssues.push(`${fileName}: No permission checks detected for sensitive ${category} commands`);
    }
    
    if ((category === 'user' || category === 'fun') && !commandPatterns.hasCooldown) {
      results.consistencyIssues.push(`${fileName}: No rate limiting/cooldown detected for ${category} commands`);
    }
    
  } catch (error) {
    console.error(`❌ Error checking ${filePath}:`, error.message);
  }
}

// Run the function check
checkMissingFunctions().catch(error => {
  console.error('Error running check:', error);
});