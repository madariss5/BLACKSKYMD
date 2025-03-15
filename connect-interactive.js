/**
 * Interactive WhatsApp Connection Tool
 * Provides a user-friendly interface for connecting to WhatsApp with various methods
 */

const readline = require('readline');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better UI
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main menu options
const mainMenuOptions = [
  { key: '1', title: 'Auto Mode (Recommended)', description: 'Tries different connection methods automatically until one works' },
  { key: '2', title: 'Standard Connection', description: 'Regular web-based QR code method' },
  { key: '3', title: 'Terminal QR Connection', description: 'Terminal-only QR code (most reliable)' },
  { key: '4', title: 'Run Connection Diagnostics', description: 'Check for issues with WhatsApp connectivity' },
  { key: '5', title: 'Clear Credentials', description: 'Remove existing auth files to start fresh' },
  { key: '6', title: 'Exit', description: 'Quit this program' }
];

// Helper function to display menu with colors
function displayMenu(title, options) {
  console.log(`\n${colors.cyan}${colors.bold}${title}${colors.reset}\n`);
  
  options.forEach(option => {
    console.log(`${colors.green}${option.key}${colors.reset}. ${colors.bold}${option.title}${colors.reset}`);
    console.log(`   ${option.description}`);
  });
  
  console.log('');
}

// Clear the terminal screen
function clearScreen() {
  process.stdout.write('\x1bc');
}

// Helper function to check if auth files exist
function checkAuthFiles() {
  const authDirs = ['./auth_info_baileys', './auth_info_simple', './auth_info_baileys_qr'];
  
  for (const dir of authDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      if (files.length > 0) {
        return true;
      }
    }
  }
  
  return false;
}

// Helper function to clear auth files
function clearAuthFiles() {
  const authDirs = ['./auth_info_baileys', './auth_info_simple', './auth_info_baileys_qr'];
  
  console.log(`${colors.yellow}Clearing authentication files...${colors.reset}`);
  
  for (const dir of authDirs) {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        console.log(`${colors.green}✓ Cleared ${dir}${colors.reset}`);
      } catch (err) {
        console.log(`${colors.red}✗ Error clearing ${dir}: ${err.message}${colors.reset}`);
      }
    }
  }
  
  console.log(`${colors.green}All authentication files cleared.${colors.reset}`);
}

// Run a command with timeout
function runCommandWithTimeout(command, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    // Set timeout
    const timeout = setTimeout(() => {
      childProcess.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Clear timeout on exit
    childProcess.on('exit', () => {
      clearTimeout(timeout);
    });
  });
}

// Run a command with spawning (for interactive processes)
function spawnCommand(command, args) {
  return new Promise((resolve) => {
    const childProcess = spawn(command, args, { stdio: 'inherit' });
    
    childProcess.on('exit', (code) => {
      resolve(code);
    });
  });
}

// Check connectivity to WhatsApp servers
async function checkWhatsAppConnectivity() {
  console.log(`${colors.blue}Checking WhatsApp connectivity...${colors.reset}`);
  
  try {
    const { execSync } = require('child_process');
    const ping = execSync('ping -c 1 web.whatsapp.com').toString();
    console.log(`${colors.green}✓ Connection to WhatsApp servers successful${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Connection to WhatsApp servers failed${colors.reset}`);
    console.log(`${colors.yellow}→ This may indicate network restrictions${colors.reset}`);
    return false;
  }
}

// Try standard connection
async function tryStandardConnection() {
  console.log(`${colors.blue}Starting standard connection...${colors.reset}`);
  console.log(`${colors.yellow}→ This will open a web interface on port 5000${colors.reset}`);
  console.log(`${colors.yellow}→ Press Ctrl+C to cancel and try another method${colors.reset}\n`);
  
  await spawnCommand('node', ['src/index.js']);
  return true;
}

// Try terminal QR
async function tryTerminalQR() {
  console.log(`${colors.blue}Starting terminal QR connection...${colors.reset}`);
  console.log(`${colors.yellow}→ Look for QR code in the terminal output${colors.reset}`);
  console.log(`${colors.yellow}→ Press Ctrl+C to cancel and try another method${colors.reset}\n`);
  
  await spawnCommand('node', ['src/terminal-qr.js']);
  return true;
}

// Try specialized QR generator
async function trySpecializedQR() {
  console.log(`${colors.blue}Starting specialized QR generator...${colors.reset}`);
  console.log(`${colors.yellow}→ This will open a web interface on port 5001${colors.reset}`);
  console.log(`${colors.yellow}→ Press Ctrl+C to cancel and try another method${colors.reset}\n`);
  
  await spawnCommand('node', ['src/qr-generator.js']);
  return true;
}

// Run diagnostics
async function runDiagnostics() {
  console.log(`${colors.blue}Running connection diagnostics...${colors.reset}\n`);
  
  try {
    await spawnCommand('node', ['check-connection.js']);
  } catch (error) {
    console.log(`${colors.red}Error running diagnostics: ${error.message}${colors.reset}`);
  }
  
  // Prompt to continue
  await new Promise(resolve => {
    rl.question(`\n${colors.yellow}Press Enter to return to main menu...${colors.reset}`, () => {
      resolve();
    });
  });
}

// Auto mode that tries multiple methods
async function runAutoMode() {
  console.log(`${colors.cyan}${colors.bold}Running Auto Mode${colors.reset}\n`);
  console.log(`${colors.yellow}This mode will automatically try different connection methods until one works.${colors.reset}`);
  console.log(`${colors.yellow}Each method will run for a short time to check if it can connect.${colors.reset}\n`);
  
  // Check if auth files exist
  const hasAuthFiles = checkAuthFiles();
  if (hasAuthFiles) {
    console.log(`${colors.green}✓ Existing authentication files found${colors.reset}`);
    console.log(`${colors.yellow}Attempting to use existing credentials first...${colors.reset}\n`);
    
    // Try standard connection with existing credentials
    try {
      await tryStandardConnection();
      return;
    } catch (error) {
      console.log(`${colors.red}Standard connection with existing credentials failed${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}! No existing authentication files found${colors.reset}`);
    console.log(`${colors.yellow}→ Will try all connection methods${colors.reset}\n`);
  }
  
  // Check connectivity first
  await checkWhatsAppConnectivity();
  
  // Try methods in order of reliability
  console.log(`\n${colors.cyan}Trying Terminal QR method (most reliable)...${colors.reset}`);
  await tryTerminalQR();
  
  console.log(`\n${colors.cyan}Terminal QR method did not complete. Trying specialized QR generator...${colors.reset}`);
  await trySpecializedQR();
  
  console.log(`\n${colors.cyan}Specialized QR generator did not complete. Trying standard connection...${colors.reset}`);
  await tryStandardConnection();
  
  console.log(`\n${colors.red}All automatic connection methods failed.${colors.reset}`);
  console.log(`${colors.yellow}→ You may need to try again later or from a different network.${colors.reset}`);
  console.log(`${colors.yellow}→ See CONNECTION_FIXES.md for manual troubleshooting steps.${colors.reset}`);
}

// Main function
async function main() {
  clearScreen();
  
  console.log(`${colors.cyan}${colors.bold}
╔══════════════════════════════════════════════════╗
║                                                  ║
║      BLACKSKY-MD WhatsApp Connection Tool        ║
║                                                  ║
╚══════════════════════════════════════════════════╝
${colors.reset}`);
  
  console.log(`This tool helps you connect to WhatsApp using the best method for your environment.`);
  
  let running = true;
  while (running) {
    displayMenu('CONNECTION OPTIONS:', mainMenuOptions);
    
    const answer = await new Promise(resolve => {
      rl.question(`${colors.cyan}Select an option (1-6):${colors.reset} `, (answer) => {
        resolve(answer.trim());
      });
    });
    
    clearScreen();
    
    switch (answer) {
      case '1':
        await runAutoMode();
        break;
      case '2':
        await tryStandardConnection();
        break;
      case '3':
        await tryTerminalQR();
        break;
      case '4':
        await runDiagnostics();
        break;
      case '5':
        await clearAuthFiles();
        break;
      case '6':
        running = false;
        break;
      default:
        console.log(`${colors.red}Invalid option. Please try again.${colors.reset}`);
    }
  }
  
  console.log(`${colors.green}Thank you for using BLACKSKY-MD WhatsApp Connection Tool!${colors.reset}`);
  rl.close();
}

// Start the program
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  rl.close();
});