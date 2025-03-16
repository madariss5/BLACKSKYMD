/**
 * GitHub Tools Launcher
 * Simple menu interface to access various GitHub tools
 */

const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Set up readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get the directory of this script
const scriptDir = __dirname;

// Menu options
const menuOptions = [
  { 
    name: 'Web-based GitHub Editor', 
    description: 'Browse and edit repository files with a web interface',
    script: 'minimal-github-editor.js',
    type: 'node'
  },
  { 
    name: 'Direct GitHub Editor', 
    description: 'Command-line tool for scripted GitHub file operations',
    script: 'direct-github-editor.js',
    type: 'node'
  },
  { 
    name: 'GitHub Token Test', 
    description: 'Verify your GitHub token has the correct permissions',
    script: 'test-github-token.js',
    type: 'node'
  },
  { 
    name: 'Fix Token Permissions', 
    description: 'Diagnose and fix GitHub token permission issues',
    script: 'token-permission-fix.js',
    type: 'node'
  },
  { 
    name: 'Exit', 
    description: 'Exit the launcher',
    action: 'exit'
  }
];

// Clear the console
function clearConsole() {
  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    process.stdout.write('\x1Bc');
  } else {
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}

// Display the menu
function displayMenu() {
  clearConsole();
  console.log('\x1b[36m%s\x1b[0m', '╔══════════════════════════════════════════════╗');
  console.log('\x1b[36m%s\x1b[0m', '║              GITHUB TOOLS MENU               ║');
  console.log('\x1b[36m%s\x1b[0m', '╚══════════════════════════════════════════════╝');
  console.log('');
  
  menuOptions.forEach((option, index) => {
    console.log(`  ${index + 1}. \x1b[33m${option.name}\x1b[0m`);
    console.log(`     ${option.description}`);
    console.log('');
  });
  
  console.log('\x1b[36m%s\x1b[0m', '──────────────────────────────────────────────');
  rl.question('\x1b[36m>\x1b[0m Enter your choice (1-' + menuOptions.length + '): ', handleMenuChoice);
}

// Handle user's menu choice
function handleMenuChoice(choice) {
  const choiceIndex = parseInt(choice) - 1;
  
  if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= menuOptions.length) {
    console.log('\x1b[31mInvalid choice. Please try again.\x1b[0m');
    setTimeout(displayMenu, 1500);
    return;
  }
  
  const selectedOption = menuOptions[choiceIndex];
  
  if (selectedOption.action === 'exit') {
    console.log('Exiting launcher...');
    rl.close();
    return;
  }
  
  launchTool(selectedOption);
}

// Launch the selected tool
function launchTool(option) {
  console.log(`\x1b[32mLaunching ${option.name}...\x1b[0m`);
  
  const scriptPath = path.join(scriptDir, option.script);
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    console.log(`\x1b[31mError: Script ${option.script} not found.\x1b[0m`);
    console.log(`Expected path: ${scriptPath}`);
    
    rl.question('\nPress Enter to return to the menu...', () => {
      displayMenu();
    });
    return;
  }
  
  let child;
  
  if (option.type === 'node') {
    child = spawn('node', [scriptPath], { stdio: 'inherit' });
  } else {
    child = spawn(scriptPath, [], { stdio: 'inherit', shell: true });
  }
  
  child.on('error', (error) => {
    console.log(`\x1b[31mError launching tool: ${error.message}\x1b[0m`);
    
    rl.question('\nPress Enter to return to the menu...', () => {
      displayMenu();
    });
  });
  
  child.on('exit', (code) => {
    console.log(`\n\x1b[33mTool exited with code ${code}.\x1b[0m`);
    
    rl.question('\nPress Enter to return to the menu...', () => {
      displayMenu();
    });
  });
}

// Start the menu
console.log('\x1b[33mStarting GitHub Tools Launcher...\x1b[0m');
displayMenu();

// Handle exit
rl.on('close', () => {
  console.log('\nThank you for using GitHub Tools Launcher!');
  process.exit(0);
});