/**
 * GitHub Repository Upload Script
 * This script uploads the WhatsApp bot to a specified GitHub repository
 * Uses environment variable for authentication (GITHUB_TOKEN)
 */

const fs = require('fs');
const path = require('path');

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'madariss5';
const REPO = 'BLACKSKYMD';
const BRANCH = 'main';

// Excluded patterns for upload
const EXCLUDED_PATTERNS = [
  /node_modules/,
  /\.git/,
  /auth_info_baileys/,
  /auth_info_baileys_backup/,
  /session\.json/,
  /\.env$/
];

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

// Function to create repository if it doesn't exist
async function createRepository() {
  try {
    log(`Creating repository: ${REPO}`);
    
    const url = 'https://api.github.com/user/repos';
    const headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'BLACKSKYMD-Upload-Script'
    };
    
    const data = {
      name: REPO,
      description: 'BLACKSKY-MD WhatsApp Bot',
      private: false,
      auto_init: true
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create repository: ${errorText}`);
    }
    
    log(`Repository ${REPO} created successfully`, 'success');
    return true;
  } catch (error) {
    log(`Error creating repository: ${error.message}`, 'error');
    return false;
  }
}

// Function to get all files to upload
function getFilesToUpload(dir = '.', filesToUpload = [], base = '') {
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const relativePath = path.join(base, file);
      const stat = fs.statSync(fullPath);
      
      // Check if file/directory should be excluded
      const shouldExclude = EXCLUDED_PATTERNS.some(pattern => pattern.test(fullPath));
      
      if (shouldExclude) {
        log(`Skipping excluded path: ${fullPath}`, 'warning');
        continue;
      }
      
      if (stat.isDirectory()) {
        getFilesToUpload(fullPath, filesToUpload, relativePath);
      } else {
        filesToUpload.push({
          path: relativePath.replace(/\\/g, '/'), // Normalize path for GitHub
          fullPath: fullPath
        });
      }
    }
    
    return filesToUpload;
  } catch (error) {
    log(`Error getting files to upload: ${error.message}`, 'error');
    return filesToUpload;
  }
}

// Function to get file content
function getFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return Buffer.from(content).toString('base64');
  } catch (error) {
    log(`Error reading file ${filePath}: ${error.message}`, 'error');
    return null;
  }
}

// Function to upload a file to GitHub
async function uploadFile(filePath) {
  try {
    log(`Uploading ${filePath.path}...`);
    
    // Check if file already exists
    let sha = null;
    try {
      const existingFile = await githubRequest(`/contents/${filePath.path}`);
      if (existingFile && existingFile.sha) {
        sha = existingFile.sha;
        log(`File exists, will update: ${filePath.path}`);
      }
    } catch (error) {
      // File doesn't exist, will create it
      log(`File does not exist yet, will create: ${filePath.path}`);
    }
    
    // Get file content
    const content = getFileContent(filePath.fullPath);
    if (!content) {
      log(`Failed to read file content: ${filePath.path}`, 'error');
      return false;
    }
    
    // Create or update file
    const data = {
      message: `Upload file: ${filePath.path}`,
      content: content,
      branch: BRANCH
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    const response = await githubRequest(`/contents/${filePath.path}`, 'PUT', data);
    
    if (response.status === 200 || response.status === 201) {
      log(`Successfully uploaded: ${filePath.path}`, 'success');
      return true;
    } else {
      log(`Failed to upload: ${filePath.path}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Error uploading file ${filePath.path}: ${error.message}`, 'error');
    return false;
  }
}

// Function to upload all files
async function uploadAllFiles() {
  try {
    // Get all files to upload
    const filesToUpload = getFilesToUpload();
    
    if (filesToUpload.length === 0) {
      log('No files found to upload', 'warning');
      return false;
    }
    
    log(`Found ${filesToUpload.length} files to upload`);
    
    // Create directories as needed
    const directories = new Set();
    filesToUpload.forEach(file => {
      const dir = path.dirname(file.path);
      if (dir !== '.') {
        directories.add(dir);
      }
    });
    
    // Upload each file
    let successCount = 0;
    let failureCount = 0;
    
    // Sort files to ensure directories are created first
    const sortedFiles = [...filesToUpload].sort((a, b) => a.path.localeCompare(b.path));
    
    for (const file of sortedFiles) {
      const success = await uploadFile(file);
      
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
    log(`Error uploading files: ${error.message}`, 'error');
    return false;
  }
}

// Main function
async function main() {
  try {
    log('Starting WhatsApp bot upload to GitHub...');
    
    // Check if repository exists
    let repoExists = await checkRepository();
    
    // Create repository if it doesn't exist
    if (!repoExists) {
      log('Repository does not exist, creating...', 'warning');
      const repoCreated = await createRepository();
      
      if (!repoCreated) {
        log('Failed to create repository. Exiting.', 'error');
        return;
      }
      
      repoExists = true;
    }
    
    // Upload all files
    if (repoExists) {
      await uploadAllFiles();
    }
    
    log('Upload process completed', 'success');
  } catch (error) {
    log(`Unhandled error: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();