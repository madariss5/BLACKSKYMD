/**
 * Quick Connect Script for WhatsApp Bot
 * This script tries all connection methods sequentially until one works
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for prettier output
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

// Connection methods to try in order of preference
const connectionMethods = [
  { 
    name: 'Standard Connection', 
    command: 'node src/index.js',
    timeout: 30000,
    desc: 'Standard web-based connection method'
  },
  { 
    name: 'Terminal QR Connection', 
    command: 'node src/terminal-qr.js',
    timeout: 30000,
    desc: 'Terminal-only QR code method (most reliable)'
  },
  { 
    name: 'Alternative Browser Method', 
    command: 'node try-alternate-browser.js',
    timeout: 60000,
    desc: 'Web-based connection with browser switching capabilities'
  }
];

// Helper function to wait for a given time in ms
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to clear old auth state
async function clearAuthState() {
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
    }
  }
  
  console.log(`${colors.green}Authentication state cleared successfully.${colors.reset}\n`);
  await sleep(1000);
}

// Try a connection method with timeout
async function tryConnectionMethod(method) {
  return new Promise((resolve) => {
    console.log(`\n${colors.cyan}${colors.bold}Trying ${method.name}...${colors.reset}`);
    console.log(`${colors.yellow}${method.desc}${colors.reset}`);
    console.log(`${colors.yellow}This attempt will timeout after ${method.timeout / 1000} seconds if unsuccessful.${colors.reset}`);
    console.log(`${colors.yellow}Press Ctrl+C to skip to the next method.${colors.reset}\n`);
    
    // Split command into command and args
    const parts = method.command.split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    
    const childProcess = spawn(command, args, { stdio: 'inherit' });
    let timeoutId = null;
    
    // Set timeout
    timeoutId = setTimeout(() => {
      console.log(`\n${colors.red}Attempt with ${method.name} timed out after ${method.timeout / 1000} seconds.${colors.reset}`);
      childProcess.kill();
      resolve(false);
    }, method.timeout);
    
    // Handle process exit
    childProcess.on('exit', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        console.log(`\n${colors.green}${method.name} completed successfully!${colors.reset}`);
        resolve(true);
      } else {
        console.log(`\n${colors.red}${method.name} exited with code: ${code || 'unknown'}${colors.reset}`);
        resolve(false);
      }
    });
    
    // Handle process error
    childProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      console.log(`\n${colors.red}Error starting ${method.name}: ${error.message}${colors.reset}`);
      resolve(false);
    });
  });
}

// Main function
async function main() {
  console.log(`${colors.cyan}${colors.bold}
╔══════════════════════════════════════════════════╗
║                                                  ║
║      WhatsApp Bot Quick Connect Script           ║
║                                                  ║
╚══════════════════════════════════════════════════╝
${colors.reset}`);
  
  console.log(`This script will try different connection methods until one succeeds.`);
  console.log(`It will try to connect using each method for a limited time before moving to the next method.`);
  
  // Ask if user wants to clear auth state first
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const clearAuth = await new Promise(resolve => {
    readline.question(`\n${colors.yellow}Do you want to clear authentication state before starting? (y/n): ${colors.reset}`, (answer) => {
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
  
  readline.close();
  
  if (clearAuth) {
    await clearAuthState();
  }
  
  // Try each connection method
  let success = false;
  for (const method of connectionMethods) {
    success = await tryConnectionMethod(method);
    if (success) {
      break;
    }
    
    console.log(`${colors.yellow}Moving to the next connection method...${colors.reset}`);
    await sleep(2000);
  }
  
  if (!success) {
    console.log(`\n${colors.red}${colors.bold}All connection methods failed.${colors.reset}`);
    console.log(`\n${colors.yellow}Possible reasons:${colors.reset}`);
    console.log(`${colors.yellow}1. WhatsApp is blocking connections from this IP address${colors.reset}`);
    console.log(`${colors.yellow}2. Network connectivity issues${colors.reset}`);
    console.log(`${colors.yellow}3. WhatsApp servers might be having temporary issues${colors.reset}`);
    
    console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
    console.log(`${colors.yellow}1. Try connecting from a different network${colors.reset}`);
    console.log(`${colors.yellow}2. Wait a few hours before trying again${colors.reset}`);
    console.log(`${colors.yellow}3. Check CONNECTION_README.md and CONNECTION_FIXES.md for more troubleshooting tips${colors.reset}`);
  }
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});