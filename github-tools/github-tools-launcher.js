/**
 * GitHub Tools Launcher
 * Unified interface to access all GitHub tools
 */

const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to tools directory
const TOOLS_DIR = path.resolve(__dirname);

// Tool definitions
const TOOLS = [
  {
    name: 'Minimal GitHub Editor',
    description: 'Simple editor for GitHub repositories',
    script: 'minimal-github-editor.js'
  },
  {
    name: 'Fork Helper Utility',
    description: 'Helps manage and track repository forks',
    script: 'fork-helper.js'
  },
  {
    name: 'Upload Fork Guides',
    description: 'Upload fork-related guides to GitHub',
    script: 'upload-fork-guides.js'
  },
  {
    name: 'Test GitHub API',
    description: 'Simple test to verify GitHub API functionality',
    script: 'simple-test-editor.js'
  },
  {
    name: 'Simple GitHub Editor',
    description: 'Original editor with more features',
    script: 'simple-github-editor.js'
  },
  {
    name: 'GitHub File Editor',
    description: 'Full-featured file editor',
    script: 'github-file-editor.js'
  },
  {
    name: 'GitHub Browser Debug',
    description: 'Diagnose and fix browser issues with GitHub',
    script: 'github-browser-debug.js'
  },
  {
    name: 'GitHub Permissions Fix',
    description: 'Fix repository permission issues',
    script: 'github-permissions-fix.js'
  },
];

// Simple prompt function
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Run a tool
function runTool(scriptPath) {
  return new Promise((resolve) => {
    console.log(`\nLaunching: ${scriptPath}\n`);
    
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: TOOLS_DIR
    });
    
    child.on('exit', (code) => {
      console.log(`\nTool exited with code: ${code}\n`);
      resolve();
    });
  });
}

// Main menu
async function mainMenu() {
  while (true) {
    console.log('\n===============================');
    console.log('  GITHUB TOOLS LAUNCHER');
    console.log('===============================\n');
    
    console.log('Available Tools:');
    TOOLS.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   ${tool.description}`);
    });
    
    console.log('\n0. Exit');
    
    const choice = await prompt('\nSelect a tool (0-8): ');
    const choiceNum = parseInt(choice);
    
    if (choice === '0') {
      console.log('Exiting GitHub Tools Launcher. Goodbye!');
      break;
    } else if (!isNaN(choiceNum) && choiceNum > 0 && choiceNum <= TOOLS.length) {
      const selectedTool = TOOLS[choiceNum - 1];
      await runTool(path.join(TOOLS_DIR, selectedTool.script));
    } else {
      console.log('Invalid choice. Please try again.');
    }
  }
}

// Main function
async function main() {
  try {
    console.log('=============================================');
    console.log('  GITHUB TOOLS LAUNCHER');
    console.log('  Unified interface for GitHub utilities');
    console.log('=============================================\n');
    
    console.log('This launcher provides access to various GitHub tools');
    console.log('to help you manage your repository, edit files, and more.');
    
    // Start the main menu
    await mainMenu();
  } catch (error) {
    console.log(`Unexpected error: ${error.message}`);
    console.error(error);
  } finally {
    // Make sure readline interface is closed
    rl.close();
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nExiting GitHub Tools Launcher. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});