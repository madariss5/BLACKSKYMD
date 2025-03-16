/**
 * Simple GitHub Editor
 * A streamlined and error-resistant GitHub file editor designed for reliability
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_INFO = process.env.GITHUB_REPOSITORY || 'madariss5/BLACKSKY';
const [OWNER, REPO] = REPO_INFO.split('/');

// Set up colors for better visualization
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Create readline interface for user input
let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simple logging function
function log(message, type = 'info') {
  const styles = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    title: `${colors.cyan}${colors.bright}`,
  };
  
  console.log(`${styles[type]} ${message}`);
}

// Prompt for user input with enhanced reliability
function prompt(question) {
  return new Promise((resolve) => {
    // Create new readline interface if needed
    if (rl.closed) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    }
    
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Make GitHub API requests with error handling
function makeGitHubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    log(`Making ${method} request to ${endpoint}...`, 'info');
    
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        'User-Agent': 'Simple-GitHub-Editor',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve(parsedData);
          } catch (e) {
            resolve(responseData);
          }
        } else {
          try {
            const errorData = JSON.parse(responseData);
            reject({
              statusCode: res.statusCode,
              message: errorData.message || 'Unknown error',
              errors: errorData.errors || []
            });
          } catch (e) {
            reject({
              statusCode: res.statusCode,
              message: responseData || 'Unknown error'
            });
          }
        }
      });
    });
    
    req.on('error', (error) => {
      reject({
        message: `Network error: ${error.message}`,
        originalError: error
      });
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Verify GitHub token with detailed error reporting
async function verifyGitHubToken() {
  try {
    log('Verifying GitHub token...', 'info');
    const response = await makeGitHubRequest('');
    log(`Token verification successful. Connected to ${response.name}`, 'success');
    return { success: true, repoName: response.name };
  } catch (error) {
    log(`Token verification failed: ${error.message}`, 'error');
    
    // Provide more helpful error messages
    if (error.statusCode === 401) {
      log('Your token appears to be invalid or expired.', 'error');
      log('Please generate a new token with "repo" scope at: https://github.com/settings/tokens', 'info');
    } else if (error.statusCode === 403) {
      log('Your token does not have sufficient permissions.', 'error');
      log('Please ensure your token has the "repo" scope.', 'info');
    } else if (error.statusCode === 404) {
      log(`Repository ${OWNER}/${REPO} not found or you don't have access to it.`, 'error');
    } else if (error.message.includes('Network error')) {
      log('Network connection issue. Please check your internet connection.', 'error');
    }
    
    return { success: false, error: error.message };
  }
}

// Get file content from GitHub
async function getFileContent(filePath) {
  try {
    log(`Fetching content for ${filePath}...`, 'info');
    const response = await makeGitHubRequest(`/contents/${filePath}`);
    const content = Buffer.from(response.content, 'base64').toString('utf8');
    log(`File retrieved successfully (${content.length} bytes)`, 'success');
    return {
      content,
      sha: response.sha,
      success: true
    };
  } catch (error) {
    log(`Error fetching file: ${error.message}`, 'error');
    
    if (error.statusCode === 404) {
      return { content: null, sha: null, success: false, error: 'File not found' };
    }
    
    return { content: null, sha: null, success: false, error: error.message };
  }
}

// Create or update a file on GitHub
async function updateFile(filePath, content, message, sha = null) {
  try {
    log(`Preparing to update ${filePath}...`, 'info');
    
    const data = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    const response = await makeGitHubRequest(`/contents/${filePath}`, 'PUT', data);
    log(`File updated successfully: ${filePath}`, 'success');
    return { success: true, response };
  } catch (error) {
    log(`Error updating file: ${error.message}`, 'error');
    
    // Provide specific guidance based on error
    if (error.errors && error.errors.length > 0) {
      for (const err of error.errors) {
        log(`- ${err.message}`, 'error');
      }
    }
    
    return { success: false, error: error.message };
  }
}

// List repository contents
async function listContents(path = '') {
  try {
    log(`Listing contents for /${path}...`, 'info');
    const contents = await makeGitHubRequest(`/contents/${path}`);
    
    // Sort with directories first, then files
    const sorted = contents.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return { success: true, contents: sorted };
  } catch (error) {
    log(`Error listing contents: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

// View file with syntax highlighting hint based on extension
function viewFile(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  console.log('\n' + colors.bright + colors.yellow + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.cyan + ` FILE: ${filePath} ` + colors.reset);
  console.log(colors.bright + colors.yellow + '═'.repeat(70) + colors.reset + '\n');
  
  if (content) {
    // Add line numbers
    const lines = content.split('\n');
    const lineWidth = String(lines.length).length;
    
    lines.forEach((line, index) => {
      const lineNum = String(index + 1).padStart(lineWidth, ' ');
      console.log(`${colors.dim}${lineNum}${colors.reset} ${line}`);
    });
  } else {
    console.log(colors.red + 'Empty or binary file' + colors.reset);
  }
  
  console.log('\n' + colors.bright + colors.yellow + '═'.repeat(70) + colors.reset);
}

// Browse repository contents
async function browseRepository() {
  let currentPath = '';
  let history = [];
  
  while (true) {
    console.clear();
    console.log(colors.cyan + colors.bright);
    console.log('═'.repeat(70));
    console.log(`  GITHUB BROWSER - ${OWNER}/${REPO}`);
    console.log('═'.repeat(70) + colors.reset);
    
    console.log(`\nCurrent location: /${currentPath}`);
    console.log(colors.dim + '─'.repeat(70) + colors.reset);
    
    const result = await listContents(currentPath);
    
    if (!result.success) {
      log(`Cannot access /${currentPath}. Going back...`, 'error');
      if (history.length > 0) {
        currentPath = history.pop();
      } else {
        currentPath = '';
      }
      await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
      continue;
    }
    
    const { contents } = result;
    
    if (contents.length === 0) {
      log('This directory is empty.', 'info');
    } else {
      // Display the contents
      console.log('\n' + colors.bright + 'Contents:' + colors.reset);
      contents.forEach((item, index) => {
        const itemType = item.type === 'dir' 
          ? colors.blue + '[DIR]' + colors.reset 
          : colors.green + '[FILE]' + colors.reset;
        console.log(`${colors.yellow}${index + 1}.${colors.reset} ${itemType} ${item.name}`);
      });
    }
    
    console.log('\n' + colors.dim + '─'.repeat(70) + colors.reset);
    console.log(colors.bright + 'Commands:' + colors.reset);
    console.log(`${colors.yellow}b${colors.reset} - Go back to parent directory`);
    console.log(`${colors.yellow}h${colors.reset} - Go to home (root) directory`);
    console.log(`${colors.yellow}q${colors.reset} - Return to main menu`);
    console.log(`${colors.yellow}[number]${colors.reset} - Select item by number`);
    
    const choice = await prompt('\n' + colors.green + 'Enter command: ' + colors.reset);
    
    if (choice.toLowerCase() === 'q') {
      break;
    } else if (choice.toLowerCase() === 'b') {
      // Go to parent directory
      if (currentPath.includes('/')) {
        history.push(currentPath);
        currentPath = currentPath.split('/').slice(0, -1).join('/');
      } else if (currentPath !== '') {
        history.push(currentPath);
        currentPath = '';
      } else {
        log('Already at root directory.', 'warning');
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
      }
    } else if (choice.toLowerCase() === 'h') {
      // Go to home directory
      if (currentPath !== '') {
        history.push(currentPath);
        currentPath = '';
      } else {
        log('Already at root directory.', 'warning');
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
      }
    } else {
      const index = parseInt(choice) - 1;
      if (!isNaN(index) && index >= 0 && index < contents.length) {
        const item = contents[index];
        if (item.type === 'dir') {
          history.push(currentPath);
          currentPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        } else {
          // View file
          const result = await getFileContent(`${currentPath ? currentPath + '/' : ''}${item.name}`);
          if (result.success) {
            viewFile(result.content, item.name);
            
            // Ask if user wants to edit the file
            const editChoice = await prompt(colors.yellow + 'Do you want to edit this file? (y/n): ' + colors.reset);
            if (editChoice.toLowerCase() === 'y') {
              await editFile(`${currentPath ? currentPath + '/' : ''}${item.name}`);
            }
          } else {
            log(`Could not view file: ${result.error}`, 'error');
          }
          await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
        }
      } else {
        log('Invalid selection.', 'error');
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
      }
    }
  }
}

// Function to edit a file
async function editFile(filePath = null) {
  if (!filePath) {
    filePath = await prompt(colors.green + 'Enter the file path to edit (e.g., src/index.js): ' + colors.reset);
  }
  
  // Get current file content
  const { content, sha, success, error } = await getFileContent(filePath);
  
  if (!success) {
    log(`Cannot edit file: ${error}`, 'error');
    return { success: false, error };
  }
  
  console.log('\n' + colors.bright + 'Current content:' + colors.reset);
  viewFile(content, filePath);
  
  // Get new content
  console.log('\n' + colors.bright + 'Enter new content (type "--SAVE--" on a line by itself when done):' + colors.reset);
  console.log(colors.dim + 'Tip: Copy-paste the content above, then modify as needed.' + colors.reset);
  
  const lines = [];
  while (true) {
    const line = await prompt('');
    if (line === '--SAVE--') break;
    lines.push(line);
  }
  
  const newContent = lines.join('\n');
  
  // Check if content changed
  if (content === newContent) {
    log('No changes made to the file.', 'warning');
    return { success: false, error: 'No changes' };
  }
  
  // Get commit message
  const commitMessage = await prompt(colors.green + 'Enter commit message: ' + colors.reset);
  
  // Update the file
  const result = await updateFile(filePath, newContent, commitMessage, sha);
  
  if (result.success) {
    log(`File updated successfully: ${filePath}`, 'success');
  }
  
  return result;
}

// Function to create a new file
async function createFile() {
  const filePath = await prompt(colors.green + 'Enter the file path to create (e.g., src/newfile.js): ' + colors.reset);
  
  // Check if file already exists
  const { success } = await getFileContent(filePath);
  
  if (success) {
    log(`File already exists: ${filePath}`, 'error');
    const editChoice = await prompt(colors.yellow + 'Do you want to edit this file instead? (y/n): ' + colors.reset);
    if (editChoice.toLowerCase() === 'y') {
      return await editFile(filePath);
    }
    return { success: false, error: 'File already exists' };
  }
  
  // Get content for the new file
  console.log('\n' + colors.bright + 'Enter content for the new file (type "--SAVE--" on a line by itself when done):' + colors.reset);
  
  const lines = [];
  while (true) {
    const line = await prompt('');
    if (line === '--SAVE--') break;
    lines.push(line);
  }
  
  const content = lines.join('\n');
  
  // Get commit message
  const commitMessage = await prompt(colors.green + 'Enter commit message: ' + colors.reset);
  
  // Create the file
  const result = await updateFile(filePath, content, commitMessage);
  
  if (result.success) {
    log(`File created successfully: ${filePath}`, 'success');
  }
  
  return result;
}

// Main menu
async function mainMenu() {
  while (true) {
    console.clear();
    console.log(colors.cyan + colors.bright);
    console.log('═'.repeat(70));
    console.log(`  SIMPLE GITHUB EDITOR - ${OWNER}/${REPO}`);
    console.log('═'.repeat(70) + colors.reset);
    
    console.log(`\n${colors.yellow}1.${colors.reset} Browse repository`);
    console.log(`${colors.yellow}2.${colors.reset} Edit a file`);
    console.log(`${colors.yellow}3.${colors.reset} Create a new file`);
    console.log(`${colors.yellow}4.${colors.reset} Verify GitHub token`);
    console.log(`${colors.yellow}0.${colors.reset} Exit\n`);
    
    const choice = await prompt(colors.green + 'Enter your choice: ' + colors.reset);
    
    switch (choice) {
      case '1':
        await browseRepository();
        break;
      case '2':
        await editFile();
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
        break;
      case '3':
        await createFile();
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
        break;
      case '4':
        await verifyGitHubToken();
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
        break;
      case '0':
        log('Exiting Simple GitHub Editor. Goodbye!', 'info');
        if (!rl.closed) rl.close();
        return;
      default:
        log('Invalid choice. Please try again.', 'error');
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
    }
  }
}

// Main function
async function main() {
  try {
    // Verify GitHub token
    const tokenCheck = await verifyGitHubToken();
    
    if (!tokenCheck.success) {
      log('GitHub token verification failed. Please check your token and permissions.', 'error');
      if (!rl.closed) rl.close();
      return;
    }
    
    // Start the main menu
    await mainMenu();
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'error');
    console.error(error);
  } finally {
    // Make sure readline interface is closed
    if (!rl.closed) rl.close();
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log(colors.reset + '\nExiting Simple GitHub Editor. Goodbye!');
  if (!rl.closed) rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  if (!rl.closed) rl.close();
}).finally(() => {
  // Ensure readline is closed
  if (!rl.closed) rl.close();
});