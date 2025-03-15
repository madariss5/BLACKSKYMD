/**
 * WhatsApp Bot Connection Helper
 * This script helps initialize a WhatsApp connection when encountering issues
 */

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Create the readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connection methods
const connectionMethods = [
  { name: 'Standard Web Connection', command: 'node src/index.js', description: 'This is the default connection method with a web-based QR code. Use this first.' },
  { name: 'Terminal QR Code', command: 'node src/terminal-qr.js', description: 'Most reliable connection method that shows QR code directly in the terminal.' },
  { name: 'Web QR Generator', command: 'node src/qr-generator.js', description: 'Alternative web-based QR code with specialized connection parameters.' },
  { name: 'Clear Auth State', command: 'clear-auth', description: 'Remove existing authentication files and start fresh.' },
  { name: 'Connection Diagnostics', command: 'node check-connection.js', description: 'Check your system for WhatsApp connection compatibility issues.' },
  { name: 'Exit', command: 'exit', description: 'Quit this program.' }
];

// Display the main menu
function showMainMenu() {
  console.log(`\n${colors.cyan}=== WhatsApp Connection Helper ===\n${colors.reset}`);
  console.log(`${colors.yellow}Select a connection method:${colors.reset}\n`);
  
  connectionMethods.forEach((method, index) => {
    console.log(`${colors.green}${index + 1}. ${method.name}${colors.reset}`);
    console.log(`   ${method.description}\n`);
  });
  
  rl.question(`${colors.blue}Enter your choice (1-${connectionMethods.length}): ${colors.reset}`, (answer) => {
    const choice = parseInt(answer.trim());
    
    if (isNaN(choice) || choice < 1 || choice > connectionMethods.length) {
      console.log(`${colors.red}Invalid choice. Please try again.${colors.reset}`);
      showMainMenu();
      return;
    }
    
    const selectedMethod = connectionMethods[choice - 1];
    
    if (selectedMethod.command === 'exit') {
      console.log(`${colors.green}Exiting Connection Helper. Goodbye!${colors.reset}`);
      rl.close();
      return;
    }
    
    if (selectedMethod.command === 'clear-auth') {
      clearAuthState();
      return;
    }
    
    console.log(`\n${colors.cyan}Starting ${selectedMethod.name}...${colors.reset}`);
    console.log(`${colors.yellow}Press Ctrl+C to exit and return to the menu.${colors.reset}\n`);
    
    // Run the selected command
    const parts = selectedMethod.command.split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    
    const childProcess = spawn(command, args, { stdio: 'inherit' });
    
    childProcess.on('exit', (code) => {
      if (code !== 0) {
        console.log(`\n${colors.red}Process exited with code: ${code}${colors.reset}`);
      }
      console.log(`\n${colors.yellow}Returning to main menu...${colors.reset}`);
      showMainMenu();
    });
  });
}

// Clear authentication state
function clearAuthState() {
  console.log(`\n${colors.yellow}Clearing authentication state...${colors.reset}`);
  
  const authDirs = [
    './auth_info_baileys',
    './auth_info_simple',
    './auth_info_baileys_qr'
  ];
  
  for (const dir of authDirs) {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        console.log(`${colors.green}✓ Cleared ${dir}${colors.reset}`);
      } catch (err) {
        console.log(`${colors.red}✗ Error clearing ${dir}: ${err.message}${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}? Directory ${dir} not found${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.green}Authentication state cleared successfully.${colors.reset}`);
  console.log(`${colors.yellow}You will need to scan the QR code again when connecting.${colors.reset}\n`);
  
  // Wait for user to continue
  rl.question(`${colors.blue}Press Enter to continue...${colors.reset}`, () => {
    showMainMenu();
  });
}

// Display welcome message
console.log(`${colors.cyan}
╔══════════════════════════════════════════════════╗
║                                                  ║
║      WhatsApp Bot Connection Helper              ║
║                                                  ║
╚══════════════════════════════════════════════════╝
${colors.reset}`);

console.log(`${colors.yellow}This tool helps you connect to WhatsApp using different methods.${colors.reset}`);
console.log(`${colors.yellow}If one method doesn't work, try another.${colors.reset}`);
console.log(`${colors.yellow}For a more streamlined experience, use connect-interactive.js instead.${colors.reset}\n`);

// Show the main menu
showMainMenu();

// Handle process exit
process.on('SIGINT', () => {
  console.log(`\n${colors.green}Exiting Connection Helper. Goodbye!${colors.reset}`);
  rl.close();
  process.exit(0);
});