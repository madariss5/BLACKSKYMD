/**
 * Direct GitHub Editor
 * A simple, direct approach to GitHub file editing without interactive prompts
 *
 * Usage:
 * node direct-github-editor.js list - Lists files in the repository
 * node direct-github-editor.js view filename.txt - Views a file's content
 * node direct-github-editor.js create filename.txt "Content" "Commit message" - Creates a new file
 * node direct-github-editor.js update filename.txt "New content" "Commit message" - Updates an existing file
 * node direct-github-editor.js delete filename.txt "Commit message" - Deletes a file
 */

const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const config = {
  token: process.env.GITHUB_TOKEN,
  owner: 'madariss5', // Repository owner
  repo: 'BLACKSKY',    // Repository name
  branch: 'main'      // Default branch
};

// Colors for terminal output
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Print colored message
function log(message, color = 'blue') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// API base URL
const API_BASE_URL = `https://api.github.com/repos/${config.owner}/${config.repo}`;

// Make a GitHub API request
async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    const response = await axios({
      method,
      url,
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  } catch (error) {
    log(`GitHub API Error: ${error.message}`, 'red');
    
    if (error.response) {
      log(`Status: ${error.response.status}`, 'red');
      log(`Details: ${JSON.stringify(error.response.data)}`, 'red');
    }
    
    throw error;
  }
}

// Get file content
async function getFileContent(filePath) {
  try {
    const response = await makeRequest(`/contents/${filePath}?ref=${config.branch}`);
    return {
      content: Buffer.from(response.content, 'base64').toString('utf8'),
      sha: response.sha
    };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null; // File not found
    }
    throw error;
  }
}

// Create or update a file
async function updateFile(filePath, content, message, sha = null) {
  const payload = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: config.branch
  };
  
  if (sha) {
    payload.sha = sha;
  }
  
  return makeRequest(`/contents/${filePath}`, 'PUT', payload);
}

// Delete a file
async function deleteFile(filePath, message, sha) {
  const payload = {
    message,
    sha,
    branch: config.branch
  };
  
  return makeRequest(`/contents/${filePath}`, 'DELETE', payload);
}

// List repository contents
async function listContents(path = '') {
  try {
    const contents = await makeRequest(`/contents/${path}?ref=${config.branch}`);
    
    log(`\nContents of ${path || 'repository root'}:`, 'cyan');
    log('-'.repeat(50), 'cyan');
    
    if (!Array.isArray(contents)) {
      // Single file result
      log(`📄 ${contents.name} (${contents.size} bytes)`, 'green');
      return;
    }
    
    // Sort directories first, then files
    const sorted = contents.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
    
    sorted.forEach(item => {
      const icon = item.type === 'dir' ? '📁' : '📄';
      log(`${icon} ${item.name}${item.type === 'dir' ? '/' : ''}`, item.type === 'dir' ? 'yellow' : 'green');
    });
    
  } catch (error) {
    log(`Error listing contents: ${error.message}`, 'red');
  }
}

// View file content
async function viewFile(filePath) {
  try {
    const file = await getFileContent(filePath);
    
    if (!file) {
      log(`File not found: ${filePath}`, 'red');
      return;
    }
    
    log(`\nFile: ${filePath}`, 'cyan');
    log('-'.repeat(50), 'cyan');
    console.log(file.content);
    log('-'.repeat(50), 'cyan');
    
  } catch (error) {
    log(`Error viewing file: ${error.message}`, 'red');
  }
}

// Create a new file
async function createNewFile(filePath, content, message) {
  try {
    // Check if file already exists
    const existingFile = await getFileContent(filePath);
    
    if (existingFile) {
      log(`File already exists: ${filePath}`, 'red');
      log('Use update command to modify existing files.', 'yellow');
      return;
    }
    
    await updateFile(filePath, content, message);
    log(`File created successfully: ${filePath}`, 'green');
    
  } catch (error) {
    log(`Error creating file: ${error.message}`, 'red');
  }
}

// Update an existing file
async function updateExistingFile(filePath, content, message) {
  try {
    const file = await getFileContent(filePath);
    
    if (!file) {
      log(`File not found: ${filePath}`, 'red');
      log('Use create command for new files.', 'yellow');
      return;
    }
    
    await updateFile(filePath, content, message, file.sha);
    log(`File updated successfully: ${filePath}`, 'green');
    
  } catch (error) {
    log(`Error updating file: ${error.message}`, 'red');
  }
}

// Delete a file
async function deleteExistingFile(filePath, message) {
  try {
    const file = await getFileContent(filePath);
    
    if (!file) {
      log(`File not found: ${filePath}`, 'red');
      return;
    }
    
    await deleteFile(filePath, message, file.sha);
    log(`File deleted successfully: ${filePath}`, 'green');
    
  } catch (error) {
    log(`Error deleting file: ${error.message}`, 'red');
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  
  if (!config.token) {
    log('Error: GITHUB_TOKEN environment variable is not set.', 'red');
    process.exit(1);
  }
  
  log(`GitHub Editor for ${config.owner}/${config.repo}`, 'cyan');
  
  try {
    switch (command) {
      case 'list':
        const path = args[1] || '';
        await listContents(path);
        break;
        
      case 'view':
        if (!args[1]) {
          log('Error: Please specify a file path to view.', 'red');
          break;
        }
        await viewFile(args[1]);
        break;
        
      case 'create':
        if (args.length < 4) {
          log('Error: create command requires file path, content, and commit message.', 'red');
          log('Usage: node direct-github-editor.js create path/to/file.txt "File content" "Commit message"', 'yellow');
          break;
        }
        await createNewFile(args[1], args[2], args[3]);
        break;
        
      case 'update':
        if (args.length < 4) {
          log('Error: update command requires file path, content, and commit message.', 'red');
          log('Usage: node direct-github-editor.js update path/to/file.txt "New content" "Commit message"', 'yellow');
          break;
        }
        await updateExistingFile(args[1], args[2], args[3]);
        break;
        
      case 'delete':
        if (args.length < 3) {
          log('Error: delete command requires file path and commit message.', 'red');
          log('Usage: node direct-github-editor.js delete path/to/file.txt "Commit message"', 'yellow');
          break;
        }
        await deleteExistingFile(args[1], args[2]);
        break;
        
      default:
        log('Direct GitHub Editor', 'cyan');
        log('-'.repeat(50), 'cyan');
        log('Commands:', 'yellow');
        log('  list [path]                       - List repository contents', 'green');
        log('  view path/to/file.txt             - View file content', 'green');
        log('  create path/to/file.txt "Content" "Commit message" - Create a new file', 'green');
        log('  update path/to/file.txt "Content" "Commit message" - Update an existing file', 'green');
        log('  delete path/to/file.txt "Commit message"           - Delete a file', 'green');
        break;
    }
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'red');
  }
}

// Run the program
main();