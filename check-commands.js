/**
 * Command Verification Tool
 * Checks that all command modules load correctly without errors
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function checkCommands() {
  console.log(`${colors.bright}${colors.blue}=== WhatsApp Bot Command Verification ===\n${colors.reset}`);
  
  // Directory containing command modules
  const commandsDir = path.join(__dirname, 'src', 'commands');
  
  try {
    // Get list of command files
    const files = fs.readdirSync(commandsDir);
    
    // Filter out non-JavaScript files and subdirectories
    const jsFiles = files.filter(file => 
      fs.statSync(path.join(commandsDir, file)).isFile() && 
      file.endsWith('.js') && 
      !file.endsWith('.tmp') && 
      !file.endsWith('.bak') &&
      !file.endsWith('.new')
    );
    
    console.log(`${colors.cyan}Found ${jsFiles.length} command files to check${colors.reset}\n`);
    
    // Test each command file
    let successCount = 0;
    let failCount = 0;
    let commandCount = 0;
    
    for (const file of jsFiles) {
      const modulePath = path.join(commandsDir, file);
      console.log(`${colors.yellow}Testing ${file}...${colors.reset}`);
      
      try {
        // Attempt to load the module
        const commandModule = require(modulePath);
        
        // Check if module has expected structure
        if (!commandModule) {
          console.log(`${colors.red}❌ Failed: Module is null or undefined${colors.reset}`);
          failCount++;
          continue;
        }
        
        // Different module formats
        const hasCommands = commandModule.commands && typeof commandModule.commands === 'object';
        const isLegacyFormat = typeof commandModule === 'object' && Object.values(commandModule).some(v => typeof v === 'function');
        
        if (!hasCommands && !isLegacyFormat) {
          console.log(`${colors.red}❌ Failed: Module does not have commands object or functions${colors.reset}`);
          failCount++;
          continue;
        }
        
        // Count commands
        let moduleCommandCount = 0;
        if (hasCommands) {
          moduleCommandCount = Object.keys(commandModule.commands).filter(
            cmd => typeof commandModule.commands[cmd] === 'function' && cmd !== 'init'
          ).length;
        } else if (isLegacyFormat) {
          moduleCommandCount = Object.keys(commandModule).filter(
            cmd => typeof commandModule[cmd] === 'function' && cmd !== 'init'
          ).length;
        }
        
        commandCount += moduleCommandCount;
        
        // Check if module has init function
        const hasInit = (hasCommands && typeof commandModule.init === 'function') || 
                       (isLegacyFormat && typeof commandModule.init === 'function');
        
        console.log(`${colors.green}✅ Success: ${moduleCommandCount} commands found`);
        if (hasInit) {
          console.log(`${colors.green}✅ init() function found${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ No init() function found${colors.reset}`);
        }
        
        successCount++;
      } catch (err) {
        console.log(`${colors.red}❌ Failed to load: ${err.message}${colors.reset}`);
        console.error(err.stack);
        failCount++;
      }
      
      console.log(''); // Add spacing between modules
    }
    
    // Check subdirectories
    const subdirs = files.filter(file => fs.statSync(path.join(commandsDir, file)).isDirectory());
    if (subdirs.length > 0) {
      console.log(`${colors.cyan}Found ${subdirs.length} subdirectories with additional commands${colors.reset}\n`);
      
      for (const dir of subdirs) {
        const subdirPath = path.join(commandsDir, dir);
        console.log(`${colors.yellow}Checking subdirectory: ${dir}${colors.reset}`);
        
        try {
          const subFiles = fs.readdirSync(subdirPath)
            .filter(file => fs.statSync(path.join(subdirPath, file)).isFile() && file.endsWith('.js'));
          
          console.log(`${colors.cyan}Found ${subFiles.length} command files in ${dir}${colors.reset}`);
          
          for (const file of subFiles) {
            const modulePath = path.join(subdirPath, file);
            console.log(`${colors.yellow}Testing ${dir}/${file}...${colors.reset}`);
            
            try {
              const commandModule = require(modulePath);
              if (!commandModule) {
                console.log(`${colors.red}❌ Failed: Module is null or undefined${colors.reset}`);
                failCount++;
                continue;
              }
              
              const hasCommands = commandModule.commands && typeof commandModule.commands === 'object';
              const isLegacyFormat = typeof commandModule === 'object' && Object.values(commandModule).some(v => typeof v === 'function');
              
              if (!hasCommands && !isLegacyFormat) {
                console.log(`${colors.red}❌ Failed: Module does not have commands object or functions${colors.reset}`);
                failCount++;
                continue;
              }
              
              let moduleCommandCount = 0;
              if (hasCommands) {
                moduleCommandCount = Object.keys(commandModule.commands).filter(
                  cmd => typeof commandModule.commands[cmd] === 'function' && cmd !== 'init'
                ).length;
              } else if (isLegacyFormat) {
                moduleCommandCount = Object.keys(commandModule).filter(
                  cmd => typeof commandModule[cmd] === 'function' && cmd !== 'init'
                ).length;
              }
              
              commandCount += moduleCommandCount;
              console.log(`${colors.green}✅ Success: ${moduleCommandCount} commands found${colors.reset}`);
              successCount++;
            } catch (err) {
              console.log(`${colors.red}❌ Failed to load: ${err.message}${colors.reset}`);
              console.error(err.stack);
              failCount++;
            }
            
            console.log(''); // Add spacing between modules
          }
        } catch (err) {
          console.log(`${colors.red}❌ Failed to read subdirectory: ${err.message}${colors.reset}`);
          failCount++;
        }
      }
    }
    
    // Print summary
    console.log(`${colors.bright}${colors.blue}=== Verification Summary ===\n${colors.reset}`);
    console.log(`${colors.cyan}Total command files checked: ${jsFiles.length + (subdirs.length || 0)}${colors.reset}`);
    console.log(`${colors.green}✅ Successfully loaded: ${successCount}${colors.reset}`);
    console.log(`${colors.red}❌ Failed to load: ${failCount}${colors.reset}`);
    console.log(`${colors.cyan}Total commands found: ${commandCount}${colors.reset}`);
    
    if (failCount === 0) {
      console.log(`\n${colors.bright}${colors.green}All command modules loaded successfully!${colors.reset}`);
      return true;
    } else {
      console.log(`\n${colors.bright}${colors.red}Some command modules failed to load. Please fix the errors above.${colors.reset}`);
      return false;
    }
  } catch (err) {
    console.error(`${colors.red}Fatal error reading commands directory: ${err.message}${colors.reset}`);
    console.error(err.stack);
    return false;
  }
}

// Run the command checker
checkCommands().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});