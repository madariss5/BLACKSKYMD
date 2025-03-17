/**
 * GitHub Repository Upload Script for BLACKSKYMD
 * 
 * This script uploads the WhatsApp bot to the specified GitHub repository
 * using the GitHub API with proper authentication
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration - Update with your repository details
const REPO_OWNER = 'madariss5';
const REPO_NAME = 'BLACKSKYMD';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

// Files/directories to exclude from upload
const EXCLUDE_PATTERNS = [
  '.git',
  'node_modules',
  'auth_info_baileys',
  'auth_info_baileys_backup',
  '.env',
  'session.json',
  'logs',
  'temp'
];

// Console logging with colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Log helper function
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let color;
  
  switch (type) {
    case 'error': color = colors.red; break;
    case 'success': color = colors.green; break;
    case 'warning': color = colors.yellow; break;
    case 'info': default: color = colors.blue; break;
  }
  
  console.log(`${color}[${timestamp}] [${type.toUpperCase()}] ${message}${colors.reset}`);
}

// Make GitHub API request with authentication
async function githubRequest(endpoint, method = 'GET', data = null) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const response = await axios({
      url,
      method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'BLACKSKYMD-Uploader'
      },
      data
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      log(`GitHub API Error: ${error.response.status} - ${error.response.data.message}`, 'error');
      return { error: error.response.data.message, status: error.response.status };
    } else {
      log(`GitHub API Request Failed: ${error.message}`, 'error');
      return { error: error.message };
    }
  }
}

// Check if repository exists
async function checkRepository() {
  log(`Checking if repository ${REPO_OWNER}/${REPO_NAME} exists...`);
  
  try {
    const result = await githubRequest('');
    if (result && result.error) {
      if (result.status === 404) {
        log(`Repository ${REPO_OWNER}/${REPO_NAME} does not exist.`, 'warning');
        return false;
      } else {
        throw new Error(result.error);
      }
    }
    
    log(`Repository ${REPO_OWNER}/${REPO_NAME} exists and is accessible.`, 'success');
    return true;
  } catch (error) {
    log(`Error checking repository: ${error.message}`, 'error');
    throw error;
  }
}

// Create a new repository if it doesn't exist
async function createRepository() {
  try {
    log(`Creating new repository: ${REPO_NAME}...`);
    
    const result = await githubRequest('https://api.github.com/user/repos', 'POST', {
      name: REPO_NAME,
      description: 'BLACKSKY-MD WhatsApp Bot with Heroku deployment support',
      private: false,
      has_issues: true,
      has_projects: true,
      has_wiki: true
    });
    
    if (result && result.error) {
      throw new Error(result.error);
    }
    
    log(`Repository ${REPO_OWNER}/${REPO_NAME} created successfully!`, 'success');
    return true;
  } catch (error) {
    log(`Failed to create repository: ${error.message}`, 'error');
    throw error;
  }
}

// Get all files to upload (excluding specified patterns)
function getFilesToUpload(directory = '.', result = [], basePath = '') {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
      
      // Check if the entry should be excluded
      const shouldExclude = EXCLUDE_PATTERNS.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(relativePath);
        }
        return relativePath.includes(pattern);
      });
      
      if (shouldExclude) {
        continue;
      }
      
      if (entry.isDirectory()) {
        getFilesToUpload(fullPath, result, relativePath);
      } else {
        result.push({
          path: relativePath,
          fullPath: fullPath
        });
      }
    }
    
    return result;
  } catch (error) {
    log(`Error getting files: ${error.message}`, 'error');
    throw error;
  }
}

// Get file content and convert to base64
function getFileContentBase64(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return content.toString('base64');
  } catch (error) {
    log(`Error reading file ${filePath}: ${error.message}`, 'error');
    throw error;
  }
}

// Upload a single file to GitHub
async function uploadFile(file) {
  try {
    const { path: filePath, fullPath } = file;
    log(`Uploading: ${filePath}...`);
    
    // Get base64 content
    const content = getFileContentBase64(fullPath);
    
    // Check if file exists to get its SHA (needed for update)
    let sha = null;
    try {
      const existingFile = await githubRequest(`/contents/${filePath}`);
      if (existingFile && !existingFile.error) {
        sha = existingFile.sha;
        log(`File exists, will update: ${filePath}`, 'info');
      }
    } catch (error) {
      // File doesn't exist, will create new
    }
    
    // Create or update file
    const result = await githubRequest(`/contents/${filePath}`, 'PUT', {
      message: sha ? `Update ${filePath}` : `Add ${filePath}`,
      content: content,
      sha: sha
    });
    
    if (result && result.error) {
      throw new Error(result.error);
    }
    
    log(`Successfully uploaded: ${filePath}`, 'success');
    return true;
  } catch (error) {
    log(`Failed to upload ${file.path}: ${error.message}`, 'error');
    return false;
  }
}

// Upload all files to GitHub
async function uploadAllFiles() {
  try {
    log('Getting list of files to upload...');
    const files = getFilesToUpload();
    log(`Found ${files.length} files to upload.`, 'info');
    
    // Upload files one by one
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      log(`Processing file ${i + 1} of ${files.length}: ${file.path}`, 'info');
      
      const success = await uploadFile(file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    log(`Upload complete: ${successCount} files uploaded successfully, ${failCount} failed.`, 'info');
    return { successCount, failCount };
  } catch (error) {
    log(`Error uploading files: ${error.message}`, 'error');
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Check GitHub token
    if (!GITHUB_TOKEN) {
      log('GitHub token not provided. Set the GITHUB_TOKEN environment variable.', 'error');
      process.exit(1);
    }
    
    log('Starting GitHub upload process...', 'info');
    log(`Target: https://github.com/${REPO_OWNER}/${REPO_NAME}`, 'info');
    
    // Check if repository exists
    const repoExists = await checkRepository();
    
    // Create repository if it doesn't exist
    if (!repoExists) {
      await createRepository();
    }
    
    // Upload all files
    await uploadAllFiles();
    
    log('GitHub upload process completed successfully!', 'success');
    log(`Your repository is available at: https://github.com/${REPO_OWNER}/${REPO_NAME}`, 'success');
  } catch (error) {
    log(`GitHub upload process failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute main function
main();