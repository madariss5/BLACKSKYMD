/**
 * GitHub File Editor
 * A user-friendly interface for editing files on GitHub
 * This script allows you to edit, create, and delete files in your repository
 * without using the GitHub web interface
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { execSync } = require('child_process');
require('dotenv').config();

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'madariss5'; // Your GitHub username
const REPO = 'BLACKSKY'; // Your repository name

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
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

// Helper function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    // Only create a new readline instance if needed
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

// Helper function for logging with colors
function log(message, type = 'info') {
  const styles = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    title: `${colors.cyan}${colors.bold}`,
    section: `${colors.yellow}${colors.bold}`,
    input: `${colors.green}> ${colors.reset}`,
  };

  console.log(`${styles[type]} ${message}`);
}

// Make a request to the GitHub API
function makeGitHubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        'User-Agent': 'GitHub-File-Editor',
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
          reject({
            statusCode: res.statusCode,
            message: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Get the file content from GitHub
async function getFileContent(filePath) {
  try {
    const response = await makeGitHubRequest(`/contents/${filePath}`);
    const content = Buffer.from(response.content, 'base64').toString('utf8');
    return {
      content,
      sha: response.sha
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return { content: null, sha: null };
    }
    throw error;
  }
}

// Create or update a file on GitHub
async function createOrUpdateFile(filePath, content, message, sha = null) {
  const data = {
    message,
    content: Buffer.from(content).toString('base64'),
  };

  if (sha) {
    data.sha = sha;
  }

  try {
    const response = await makeGitHubRequest(`/contents/${filePath}`, 'PUT', data);
    return response;
  } catch (error) {
    console.error('Error creating/updating file:', error);
    throw error;
  }
}

// Delete a file from GitHub
async function deleteFile(filePath, sha, message) {
  const data = {
    message,
    sha
  };

  try {
    const response = await makeGitHubRequest(`/contents/${filePath}`, 'DELETE', data);
    return response;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// Verify GitHub token
async function verifyGitHubToken() {
  try {
    const response = await makeGitHubRequest('', 'GET');
    log(`Token verification successful. Repository: ${response.name}`, 'success');
    return true;
  } catch (error) {
    log(`Token verification failed: ${error.message}`, 'error');
    return false;
  }
}

// List repository contents
async function listRepositoryContents(path = '') {
  try {
    const contents = await makeGitHubRequest(`/contents/${path}`);
    return contents;
  } catch (error) {
    log(`Error listing repository contents: ${error.message}`, 'error');
    return [];
  }
}

// Edit a file using the local text editor
async function editFileLocally(content, filePath) {
  // Create a temporary file
  const tempFilePath = `.temp_${path.basename(filePath)}`;
  fs.writeFileSync(tempFilePath, content);
  
  // Determine which editor to use
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
  
  log(`Opening file with ${editor}. Save and exit the editor when done.`, 'info');
  
  try {
    // Open the file in the editor
    execSync(`${editor} ${tempFilePath}`, { stdio: 'inherit' });
    
    // Read the modified content
    const modifiedContent = fs.readFileSync(tempFilePath, 'utf8');
    
    // Clean up
    fs.unlinkSync(tempFilePath);
    
    return modifiedContent;
  } catch (error) {
    log(`Error while editing: ${error.message}`, 'error');
    // Clean up in case of error
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    return content;
  }
}

// Function to edit a file
async function editFile() {
  // Get the file path from the user
  const filePath = await prompt(colors.green + 'Enter the file path (e.g., src/index.js): ' + colors.reset);
  
  try {
    // Get the current file content
    const { content, sha } = await getFileContent(filePath);
    
    if (content === null) {
      log(`File not found: ${filePath}`, 'error');
      return;
    }
    
    log(`File found: ${filePath}`, 'success');
    log(`Current content (${content.length} bytes):`, 'info');
    console.log(colors.dim + '--------------------------------' + colors.reset);
    console.log(content);
    console.log(colors.dim + '--------------------------------' + colors.reset);
    
    // Ask how to edit
    const editMethod = await prompt(colors.yellow + 'Edit file using: (1) Terminal editor (2) Enter text directly: ' + colors.reset);
    
    let newContent;
    if (editMethod === '1') {
      // Edit using local text editor
      newContent = await editFileLocally(content, filePath);
    } else {
      // Enter text directly
      log('Enter new content (type "END" on a line by itself when done):', 'input');
      let lines = [];
      let line;
      while (true) {
        line = await prompt('');
        if (line === 'END') break;
        lines.push(line);
      }
      newContent = lines.join('\n');
    }
    
    // Check if content changed
    if (content === newContent) {
      log('No changes made to the file.', 'warning');
      return;
    }
    
    // Get commit message
    const commitMessage = await prompt(colors.green + 'Enter commit message: ' + colors.reset);
    
    // Update the file
    await createOrUpdateFile(filePath, newContent, commitMessage, sha);
    log(`File updated successfully: ${filePath}`, 'success');
  } catch (error) {
    log(`Error editing file: ${JSON.stringify(error)}`, 'error');
  }
}

// Function to create a new file
async function createFile() {
  // Get the file path from the user
  const filePath = await prompt(colors.green + 'Enter the file path (e.g., src/newfile.js): ' + colors.reset);
  
  try {
    // Check if file already exists
    const { content } = await getFileContent(filePath);
    
    if (content !== null) {
      log(`File already exists: ${filePath}`, 'error');
      return;
    }
    
    // Ask how to create
    const createMethod = await prompt(colors.yellow + 'Create file using: (1) Terminal editor (2) Enter text directly: ' + colors.reset);
    
    let newContent;
    if (createMethod === '1') {
      // Edit using local text editor
      newContent = await editFileLocally('', filePath);
    } else {
      // Enter text directly
      log('Enter content (type "END" on a line by itself when done):', 'input');
      let lines = [];
      let line;
      while (true) {
        line = await prompt('');
        if (line === 'END') break;
        lines.push(line);
      }
      newContent = lines.join('\n');
    }
    
    // Get commit message
    const commitMessage = await prompt(colors.green + 'Enter commit message: ' + colors.reset);
    
    // Create the file
    await createOrUpdateFile(filePath, newContent, commitMessage);
    log(`File created successfully: ${filePath}`, 'success');
  } catch (error) {
    log(`Error creating file: ${JSON.stringify(error)}`, 'error');
  }
}

// Function to delete a file
async function deleteFileFromRepo() {
  // Get the file path from the user
  const filePath = await prompt(colors.green + 'Enter the file path to delete (e.g., src/oldfile.js): ' + colors.reset);
  
  try {
    // Get the current file content and SHA
    const { content, sha } = await getFileContent(filePath);
    
    if (content === null) {
      log(`File not found: ${filePath}`, 'error');
      return;
    }
    
    // Confirm deletion
    const confirm = await prompt(colors.red + `Are you sure you want to delete ${filePath}? (yes/no): ` + colors.reset);
    
    if (confirm.toLowerCase() !== 'yes') {
      log('Deletion cancelled.', 'warning');
      return;
    }
    
    // Get commit message
    const commitMessage = await prompt(colors.green + 'Enter commit message: ' + colors.reset);
    
    // Delete the file
    await deleteFile(filePath, sha, commitMessage);
    log(`File deleted successfully: ${filePath}`, 'success');
  } catch (error) {
    log(`Error deleting file: ${JSON.stringify(error)}`, 'error');
  }
}

// Function to browse repository contents
async function browseRepository() {
  let currentPath = '';
  
  while (true) {
    log(`Current directory: /${currentPath}`, 'section');
    
    try {
      const contents = await listRepositoryContents(currentPath);
      
      // Display the contents
      log('Contents:', 'info');
      contents.forEach((item, index) => {
        const itemType = item.type === 'dir' ? colors.blue + '[DIR]' + colors.reset : colors.green + '[FILE]' + colors.reset;
        console.log(`${index + 1}. ${itemType} ${item.name}`);
      });
      
      // Options
      console.log('\n0. Go back');
      console.log('b. Go to parent directory');
      console.log('q. Return to main menu\n');
      
      const choice = await prompt(colors.green + 'Enter number to navigate, or command: ' + colors.reset);
      
      if (choice === 'q') {
        break;
      } else if (choice === 'b') {
        // Go to parent directory
        if (currentPath.includes('/')) {
          currentPath = currentPath.split('/').slice(0, -1).join('/');
        } else {
          currentPath = '';
        }
      } else if (choice === '0') {
        break;
      } else {
        const index = parseInt(choice) - 1;
        if (index >= 0 && index < contents.length) {
          const item = contents[index];
          if (item.type === 'dir') {
            currentPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          } else {
            // View file content
            log(`Fetching content for ${item.name}...`, 'info');
            const { content } = await getFileContent(`${currentPath ? currentPath + '/' : ''}${item.name}`);
            console.log(colors.dim + '--------------------------------' + colors.reset);
            console.log(content);
            console.log(colors.dim + '--------------------------------' + colors.reset);
            await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
          }
        } else {
          log('Invalid selection.', 'error');
        }
      }
    } catch (error) {
      log(`Error browsing repository: ${error.message}`, 'error');
      await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
      break;
    }
  }
}

// Main menu function
async function mainMenu() {
  while (true) {
    console.clear();
    console.log(colors.cyan + colors.bold);
    console.log('='.repeat(50));
    console.log('            GITHUB FILE EDITOR              ');
    console.log('='.repeat(50) + colors.reset);
    
    console.log(`${colors.green}Repository:${colors.reset} ${OWNER}/${REPO}\n`);
    
    console.log(`${colors.yellow}1.${colors.reset} Browse repository`);
    console.log(`${colors.yellow}2.${colors.reset} Edit a file`);
    console.log(`${colors.yellow}3.${colors.reset} Create a new file`);
    console.log(`${colors.yellow}4.${colors.reset} Delete a file`);
    console.log(`${colors.yellow}5.${colors.reset} Verify GitHub token`);
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
        await deleteFileFromRepo();
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
        break;
      case '5':
        await verifyGitHubToken();
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
        break;
      case '0':
        log('Exiting GitHub File Editor. Goodbye!', 'info');
        rl.close();
        return;
      default:
        log('Invalid choice. Please try again.', 'error');
        await prompt(colors.yellow + 'Press Enter to continue...' + colors.reset);
    }
  }
}

// Main function
async function main() {
  console.clear();
  console.log(colors.cyan + colors.bold);
  console.log('='.repeat(50));
  console.log('            GITHUB FILE EDITOR              ');
  console.log('='.repeat(50) + colors.reset);
  
  // Check if GitHub token exists
  if (!GITHUB_TOKEN) {
    log('GitHub token not found. Please set the GITHUB_TOKEN environment variable.', 'error');
    if (!rl.closed) rl.close();
    return;
  }
  
  // Verify GitHub token
  const isTokenValid = await verifyGitHubToken();
  if (!isTokenValid) {
    log('Please check your GitHub token and permissions.', 'error');
    if (!rl.closed) rl.close();
    return;
  }
  
  try {
    // Start the main menu
    await mainMenu();
  } catch (error) {
    console.error('Error in main menu:', error);
  } finally {
    if (!rl.closed) rl.close();
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log(colors.reset + '\nExiting GitHub File Editor. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  if (!rl.closed) rl.close();
}).finally(() => {
  // Make sure readline is closed to avoid process hanging
  if (!rl.closed) rl.close();
});