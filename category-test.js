/**
 * Comprehensive Category Testing Tool for WhatsApp Bot
 * Tests all command categories and generates detailed reports
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');

// Create a custom logger
const logger = {
  log: (...args) => {
    const formatted = args.map(arg => 
      typeof arg === 'object' && arg !== null 
        ? util.inspect(arg, { depth: 2, colors: false }) 
        : String(arg)
    ).join(' ');
    console.log(formatted);
    return formatted;
  },
  info: (...args) => logger.log('ℹ️', ...args),
  success: (...args) => logger.log('✅', ...args),
  warn: (...args) => logger.log('⚠️', ...args),
  error: (...args) => logger.log('❌', ...args),
};

// Main test results
const results = {
  categories: {},
  totalCommands: 0,
  validCommands: 0,
  invalidCommands: 0,
  commandsWithExternalAPIs: 0,
  commandsWithMedia: 0,
  commandsWithDatabase: 0,
};

// Get command files from a directory
async function getCommandFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and similar
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const nestedFiles = await getCommandFiles(fullPath);
          files.push(...nestedFiles);
        }
      } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
        files.push(fullPath);
      }
    }
    
    return files;
  } catch (error) {
    logger.error(`Error reading directory ${dir}:`, error.message);
    return [];
  }
}

// Test an individual command
function testCommand(name, func, categoryName) {
  try {
    // Get function parameters
    const funcStr = func.toString();
    const paramMatch = funcStr.match(/\(([^)]*)\)/);
    const params = paramMatch 
      ? paramMatch[1].split(',').map(p => p.trim()).filter(p => p) 
      : [];
    
    // Check parameter signature
    const isValidSignature = params.length >= 2;
    
    // Extract function body for analysis
    const funcBody = funcStr.substring(funcStr.indexOf('{') + 1, funcStr.lastIndexOf('}'));
    
    // Check for common patterns
    const usesDatabase = 
      funcBody.includes('getGroupSettings') || 
      funcBody.includes('getUserProfile') || 
      funcBody.includes('saveGroupSettings') ||
      funcBody.includes('db.') ||
      funcBody.includes('database.');
      
    const sendsMedia = 
      funcBody.includes('sendImage') || 
      funcBody.includes('sendVideo') || 
      funcBody.includes('sendAudio') ||
      funcBody.includes('sendSticker') ||
      funcBody.includes('sendDocument') ||
      funcBody.includes('sendGif');
      
    const usesExternalAPI = 
      funcBody.includes('axios.') || 
      funcBody.includes('fetch(') ||
      funcBody.includes('request(') ||
      funcBody.includes('http.') ||
      funcBody.includes('API_KEY');
    
    // Update global stats
    if (isValidSignature) results.validCommands++;
    else results.invalidCommands++;
    
    if (usesDatabase) results.commandsWithDatabase++;
    if (sendsMedia) results.commandsWithMedia++;
    if (usesExternalAPI) results.commandsWithExternalAPIs++;
    
    // Return test result
    return {
      name,
      category: categoryName,
      isValid: isValidSignature,
      paramCount: params.length,
      params,
      usesDatabase,
      sendsMedia,
      usesExternalAPI,
    };
  } catch (error) {
    logger.error(`Error testing command ${name}:`, error.message);
    return {
      name,
      category: categoryName,
      isValid: false,
      error: error.message,
    };
  }
}

// Test a command module
async function testModule(filePath) {
  try {
    const relativePath = path.relative(process.cwd(), filePath);
    logger.info(`Testing module: ${relativePath}`);
    
    // Import module
    const moduleObj = require(filePath);
    
    // Determine module structure and category
    const hasCategory = typeof moduleObj.category === 'string';
    const hasCommands = typeof moduleObj.commands === 'object';
    const hasInit = typeof moduleObj.init === 'function';
    
    // Get category name (from property or filename)
    let categoryName;
    if (hasCategory) {
      categoryName = moduleObj.category;
    } else {
      const dirName = path.basename(path.dirname(filePath));
      const fileName = path.basename(filePath, '.js');
      categoryName = dirName === 'commands' ? fileName : dirName;
    }
    
    // Initialize category in results if not exists
    if (!results.categories[categoryName]) {
      results.categories[categoryName] = {
        name: categoryName,
        path: relativePath,
        commandCount: 0,
        validCommands: 0,
        invalidCommands: 0,
        withDatabase: 0,
        withMedia: 0,
        withExternalAPI: 0,
        commands: [],
        hasInit: hasInit,
      };
    }
    
    // Get command object
    const commands = hasCommands ? moduleObj.commands : moduleObj;
    
    // Find all commands
    const commandNames = Object.keys(commands).filter(name => 
      typeof commands[name] === 'function' && name !== 'init'
    );
    
    logger.success(`Found ${commandNames.length} commands in ${categoryName}`);
    
    // Test each command
    for (const name of commandNames) {
      const command = commands[name];
      const testResult = testCommand(name, command, categoryName);
      
      // Update category stats
      results.categories[categoryName].commandCount++;
      if (testResult.isValid) results.categories[categoryName].validCommands++;
      else results.categories[categoryName].invalidCommands++;
      
      if (testResult.usesDatabase) results.categories[categoryName].withDatabase++;
      if (testResult.sendsMedia) results.categories[categoryName].withMedia++;
      if (testResult.usesExternalAPI) results.categories[categoryName].withExternalAPI++;
      
      results.categories[categoryName].commands.push(testResult);
    }
    
    // Update total command count
    results.totalCommands += commandNames.length;
    
    return {
      category: categoryName,
      commandCount: commandNames.length,
    };
  } catch (error) {
    logger.error(`Error testing module ${filePath}:`, error.message);
    return {
      error: error.message,
      filePath,
    };
  }
}

// Generate a markdown report
async function generateReport() {
  let report = `# WhatsApp Bot Command Test Report\n\n`;
  
  // Summary section
  report += `## Summary\n\n`;
  report += `- Total commands: ${results.totalCommands}\n`;
  report += `- Valid commands: ${results.validCommands}\n`;
  report += `- Invalid commands: ${results.invalidCommands}\n`;
  report += `- Commands using database: ${results.commandsWithDatabase}\n`;
  report += `- Commands with media handling: ${results.commandsWithMedia}\n`;
  report += `- Commands using external APIs: ${results.commandsWithExternalAPIs}\n\n`;
  
  // Category details
  report += `## Categories\n\n`;
  
  Object.values(results.categories).forEach(category => {
    report += `### ${category.name} (${category.commandCount})\n\n`;
    report += `- File: ${category.path}\n`;
    report += `- Valid commands: ${category.validCommands}\n`;
    report += `- Invalid commands: ${category.invalidCommands}\n`;
    report += `- Has init function: ${category.hasInit ? 'Yes' : 'No'}\n`;
    report += `- Commands using database: ${category.withDatabase}\n`;
    report += `- Commands with media handling: ${category.withMedia}\n`;
    report += `- Commands using external APIs: ${category.withExternalAPI}\n\n`;
    
    // List all commands
    report += `#### Commands\n\n`;
    report += `| Command | Valid | Parameters | Database | Media | External API |\n`;
    report += `|---------|-------|------------|----------|-------|-------------|\n`;
    
    category.commands.forEach(cmd => {
      report += `| ${cmd.name} | ${cmd.isValid ? '✅' : '❌'} | ${cmd.params?.join(', ') || '-'} | ${cmd.usesDatabase ? '✅' : '❌'} | ${cmd.sendsMedia ? '✅' : '❌'} | ${cmd.usesExternalAPI ? '✅' : '❌'} |\n`;
    });
    
    report += `\n`;
  });
  
  // Write report to file
  try {
    await fs.writeFile('command-report.md', report);
    logger.success('Report saved to command-report.md');
  } catch (error) {
    logger.error('Failed to write report:', error.message);
  }
  
  return report;
}

// Main test function
async function runTests() {
  logger.info('Starting command tests...');
  
  // Get all command files
  const commandsDir = path.join(process.cwd(), 'src', 'commands');
  const files = await getCommandFiles(commandsDir);
  
  logger.info(`Found ${files.length} command files to test`);
  
  // Test each file
  for (const file of files) {
    await testModule(file);
  }
  
  // Generate report
  await generateReport();
  
  logger.info('Tests completed!');
}

// Run the tests
runTests().catch(error => {
  logger.error('Test runner error:', error);
});