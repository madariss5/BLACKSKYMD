/**
 * Command Modules Upload Script
 * This script uploads the commands directory to GitHub for a complete deployment
 */

const fs = require('fs');
const path = require('path');

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'madariss5';
const REPO = 'BLACKSKYMD';
const BRANCH = 'main';

// Function to log with colors
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',    // Blue
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m'  // Yellow
  };
  
  const colorCode = colors[type] || colors.info;
  const timestamp = new Date().toISOString();
  console.log(`${colorCode}[${timestamp}] [${type.toUpperCase()}] ${message}\x1b[0m`);
}

// Function to make GitHub API requests
async function githubRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}${endpoint}`;
    const headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'BLACKSKYMD-Upload-Script'
    };
    
    const options = {
      method,
      headers
    };
    
    if (data) {
      options.body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }
    
    if (method === 'GET' && response.status !== 404) {
      return await response.json();
    }
    
    return response;
  } catch (error) {
    log(`API request error: ${error.message}`, 'error');
    throw error;
  }
}

// Function to check if repository exists
async function checkRepository() {
  try {
    log(`Checking repository: ${OWNER}/${REPO}`);
    const response = await githubRequest('');
    
    if (response && response.name) {
      log(`Repository ${OWNER}/${REPO} exists and is accessible`, 'success');
      return true;
    }
    return false;
  } catch (error) {
    log(`Failed to access repository: ${error.message}`, 'error');
    return false;
  }
}

// Function to get all command files
function getCommandFiles() {
  const commandsDirectory = path.join(__dirname, 'commands');
  const files = [];
  
  function scanDir(dir, baseDir = '') {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(baseDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath, relativePath); // Recursively scan subdirectories
        } else if (stat.isFile() && item.endsWith('.js')) {
          files.push({
            path: `commands/${relativePath}`,
            fullPath: fullPath
          });
        }
      }
    } catch (error) {
      log(`Error scanning directory ${dir}: ${error.message}`, 'error');
    }
  }
  
  if (fs.existsSync(commandsDirectory)) {
    scanDir(commandsDirectory);
  } else {
    log(`Commands directory not found: ${commandsDirectory}`, 'warning');
  }
  
  return files;
}

// Function to upload a file to GitHub
async function uploadFile(fileInfo) {
  try {
    log(`Uploading ${fileInfo.path}...`);
    
    // Check if file already exists
    let sha = null;
    try {
      const existingFile = await githubRequest(`/contents/${fileInfo.path}`);
      if (existingFile && existingFile.sha) {
        sha = existingFile.sha;
        log(`File exists, will update: ${fileInfo.path}`);
      }
    } catch (error) {
      // File doesn't exist, will create it
      log(`File does not exist yet, will create: ${fileInfo.path}`);
    }
    
    // Read file content
    const content = fs.readFileSync(fileInfo.fullPath, 'utf8');
    const contentEncoded = Buffer.from(content).toString('base64');
    
    // Create or update file
    const data = {
      message: `Upload command module: ${fileInfo.path}`,
      content: contentEncoded,
      branch: BRANCH
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    const response = await githubRequest(`/contents/${fileInfo.path}`, 'PUT', data);
    
    if (response.status === 200 || response.status === 201) {
      log(`Successfully uploaded: ${fileInfo.path}`, 'success');
      return true;
    } else {
      log(`Failed to upload: ${fileInfo.path}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Error uploading file ${fileInfo.path}: ${error.message}`, 'error');
    return false;
  }
}

// Function to create directory structure if needed
async function createDirectoryStructure(filePath) {
  const dirPath = path.dirname(filePath);
  if (dirPath === '.') return true;
  
  const parts = dirPath.split('/');
  let currentPath = '';
  
  for (let i = 0; i < parts.length; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    
    try {
      // Check if directory exists by trying to get a file that likely doesn't exist
      const checkPath = `${currentPath}/_directory_check_`;
      await githubRequest(`/contents/${checkPath}`);
      // If we get here without 404, something unexpected is happening
      log(`Unexpected response when checking directory: ${currentPath}`, 'warning');
    } catch (error) {
      // 404 is expected, any other error is a problem
      if (error.message.includes('404')) {
        // Directory might not exist, try to create a placeholder
        if (i === parts.length - 1) {
          // This is the last directory part, don't create a placeholder
          continue;
        }
        
        try {
          const placeholderPath = `${currentPath}/.gitkeep`;
          const data = {
            message: `Create directory: ${currentPath}`,
            content: Buffer.from('').toString('base64'),
            branch: BRANCH
          };
          
          await githubRequest(`/contents/${placeholderPath}`, 'PUT', data);
          log(`Created directory structure: ${currentPath}`, 'success');
        } catch (dirError) {
          log(`Error creating directory ${currentPath}: ${dirError.message}`, 'error');
          return false;
        }
      } else {
        log(`Error checking directory ${currentPath}: ${error.message}`, 'error');
        return false;
      }
    }
  }
  
  return true;
}

// Function to upload all command files
async function uploadCommandFiles() {
  try {
    // Check if repository exists and is accessible
    const repoExists = await checkRepository();
    if (!repoExists) {
      log('Repository not accessible. Exiting.', 'error');
      return false;
    }
    
    // Get all command files
    const commandFiles = getCommandFiles();
    
    if (commandFiles.length === 0) {
      log('No command files found to upload. Exiting.', 'warning');
      return false;
    }
    
    log(`Found ${commandFiles.length} command files to upload`);
    
    // Ensure the commands directory structure exists first
    await createDirectoryStructure('commands/placeholder.js');
    
    // Upload each file
    let successCount = 0;
    let failureCount = 0;
    
    for (const fileInfo of commandFiles) {
      // Ensure directory structure exists for this file
      await createDirectoryStructure(fileInfo.path);
      
      // Upload the file
      const success = await uploadFile(fileInfo);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log(`Upload complete. ${successCount} files uploaded successfully, ${failureCount} files failed.`, 
        failureCount === 0 ? 'success' : 'warning');
    
    return failureCount === 0;
  } catch (error) {
    log(`Error in upload process: ${error.message}`, 'error');
    return false;
  }
}

// Main function
async function main() {
  try {
    log('Starting command modules upload...');
    
    // Upload the command files
    await uploadCommandFiles();
    
    log('Command modules upload process completed', 'success');
  } catch (error) {
    log(`Unhandled error: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();