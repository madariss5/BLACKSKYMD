/**
 * BLACKSKY-MD Quick Start Script
 * This script provides an easy way to choose and run different connection methods
 */

const { exec } = require('child_process');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Available connection methods
const connectionMethods = [
  { name: 'Standard Web QR', command: 'node src/qr-web-server.js', description: 'Standard web-based QR code connection' },
  { name: 'Enhanced Connection', command: 'node enhanced-connection.js', description: 'Tries multiple browser fingerprints automatically' },
  { name: 'Firefox Connection', command: 'node firefox-connect.js', description: 'Uses Firefox browser fingerprinting' },
  { name: 'Safari Connection', command: 'node safari-connect.js', description: 'Uses Safari browser fingerprinting' },
  { name: 'Fresh Connection', command: 'node fresh-connection.js', description: 'Starts with a completely fresh session' },
  { name: 'Terminal QR', command: 'node src/terminal-qr.js', description: 'Shows QR code in terminal (for SSH)' },
  { name: 'Update GitHub', command: 'node github-update.js', description: 'Updates GitHub repository with your changes' }
];

// ANSI color codes for better display
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
  },
  
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m"
  }
};

// Display header
function displayHeader() {
  console.log(`${colors.fg.cyan}${colors.bright}===============================================${colors.reset}`);
  console.log(`${colors.fg.cyan}${colors.bright}           BLACKSKY-MD Quick Start            ${colors.reset}`);
  console.log(`${colors.fg.cyan}${colors.bright}===============================================${colors.reset}`);
  console.log(`${colors.fg.yellow}Choose a connection method to start:${colors.reset}\n`);
}

// Display available connection methods
function displayConnectionMethods() {
  connectionMethods.forEach((method, index) => {
    console.log(`${colors.fg.green}${index + 1}. ${colors.bright}${method.name}${colors.reset} - ${method.description}`);
  });
  console.log(`\n${colors.fg.red}0. Exit${colors.reset}`);
  console.log(`\n${colors.fg.yellow}Enter your choice (0-${connectionMethods.length}):${colors.reset}`);
}

// Execute a command
function executeCommand(command) {
  console.log(`\n${colors.fg.blue}Executing: ${command}${colors.reset}\n`);
  
  const childProcess = exec(command);
  
  childProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  childProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  childProcess.on('close', (code) => {
    console.log(`\n${colors.fg.yellow}Process exited with code ${code}${colors.reset}`);
    
    if (code !== 0) {
      console.log(`\n${colors.fg.red}Connection attempt failed. Try another method or check your network.${colors.reset}`);
    }
    
    // Prompt to continue or exit
    rl.question(`\n${colors.fg.yellow}Press Enter to return to the menu or type 'exit' to quit:${colors.reset} `, (answer) => {
      if (answer.toLowerCase() === 'exit') {
        console.log(`\n${colors.fg.cyan}Goodbye!${colors.reset}`);
        rl.close();
        process.exit(0);
      } else {
        startMenu();
      }
    });
  });
  
  // Allow for graceful termination
  process.on('SIGINT', () => {
    childProcess.kill();
    console.log(`\n${colors.fg.red}Process terminated by user.${colors.reset}`);
    rl.question(`\n${colors.fg.yellow}Press Enter to return to the menu or type 'exit' to quit:${colors.reset} `, (answer) => {
      if (answer.toLowerCase() === 'exit') {
        console.log(`\n${colors.fg.cyan}Goodbye!${colors.reset}`);
        rl.close();
        process.exit(0);
      } else {
        startMenu();
      }
    });
  });
}

// Display main menu and handle user input
function startMenu() {
  console.clear();
  displayHeader();
  displayConnectionMethods();
  
  rl.question('', (answer) => {
    const choice = parseInt(answer.trim());
    
    if (isNaN(choice) || choice < 0 || choice > connectionMethods.length) {
      console.log(`\n${colors.fg.red}Invalid choice. Please try again.${colors.reset}`);
      setTimeout(startMenu, 1000);
      return;
    }
    
    if (choice === 0) {
      console.log(`\n${colors.fg.cyan}Goodbye!${colors.reset}`);
      rl.close();
      return;
    }
    
    const selectedMethod = connectionMethods[choice - 1];
    console.log(`\n${colors.fg.green}You selected: ${selectedMethod.name}${colors.reset}`);
    
    executeCommand(selectedMethod.command);
  });
}

// Display troubleshooting tips
function displayTroubleshootingTips() {
  console.log(`\n${colors.fg.yellow}${colors.bright}Troubleshooting Tips:${colors.reset}`);
  console.log(`${colors.fg.white}1. If one connection method fails, try another one${colors.reset}`);
  console.log(`${colors.fg.white}2. For cloud environments, Enhanced Connection often works best${colors.reset}`);
  console.log(`${colors.fg.white}3. For slow networks, try Terminal QR method${colors.reset}`);
  console.log(`${colors.fg.white}4. If all methods fail, try Fresh Connection to start clean${colors.reset}`);
  console.log(`${colors.fg.white}5. Make sure to scan the QR code quickly before it expires${colors.reset}`);
  console.log(`${colors.fg.white}6. Visit http://localhost:5007 in your browser to see the QR code${colors.reset}`);
}

// Display welcome message and start menu
console.clear();
displayHeader();
displayTroubleshootingTips();
console.log('');
displayConnectionMethods();

rl.question('', (answer) => {
  const choice = parseInt(answer.trim());
  
  if (isNaN(choice) || choice < 0 || choice > connectionMethods.length) {
    console.log(`\n${colors.fg.red}Invalid choice. Please try again.${colors.reset}`);
    setTimeout(startMenu, 1000);
    return;
  }
  
  if (choice === 0) {
    console.log(`\n${colors.fg.cyan}Goodbye!${colors.reset}`);
    rl.close();
    return;
  }
  
  const selectedMethod = connectionMethods[choice - 1];
  console.log(`\n${colors.fg.green}You selected: ${selectedMethod.name}${colors.reset}`);
  
  executeCommand(selectedMethod.command);
});

// Handle Ctrl+C to exit gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.fg.cyan}Goodbye!${colors.reset}`);
  rl.close();
  process.exit(0);
});