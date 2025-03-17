/**
 * Essential Files Uploader for GitHub
 * This script uploads only the essential files for the WhatsApp bot to GitHub
 */

const fs = require('fs');
const path = require('path');

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'madariss5';
const REPO = 'BLACKSKYMD';
const BRANCH = 'main';

// List of essential files for the WhatsApp bot
const ESSENTIAL_PATHS = [
  // Core files
  'package.json',
  'Procfile',
  'Dockerfile',
  'heroku.yml',
  '.slugignore',
  'app.json',
  'HEROKU_DEPLOYMENT.md',
  
  // Source files
  'src/cloud-qr-server.js',
  'src/heroku-session-restore.js',
  'src/index.js',
  'src/reaction-gifs-fallback.js',
  'src/simplified-message-handler.js',
  
  // Command Files - already uploaded with upload-commands.js
  'commands/basic.js',
  'commands/reactions.js',
  'commands/admin.js',
  'commands/utility.js',
  
  // Utility files
  'src/utils/fileUtils.js',
  'src/utils/error.js',
  'src/utils/errorHandler.js',
  'src/utils/jidHelper.js',
  'src/utils/backupManager.js',
  'src/utils/calculationUtils.js',
  'src/utils/commandLoader.js',
  'src/utils/helpers.js',
  'src/utils/fetchNsfwImage.js',
  
  // Additional deployment files
  'README.md'
];

// Check if files exist before attempting to upload
function fileExistsSync(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Filter for files that actually exist
function filterExistingFiles(paths) {
  const existingFiles = [];
  const missingFiles = [];
  
  for (const path of paths) {
    if (fileExistsSync(path)) {
      existingFiles.push(path);
    } else {
      missingFiles.push(path);
    }
  }
  
  return { existingFiles, missingFiles };
}

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
    log(`Uploading ${filePath}...`);
    
    // Check if file already exists
    let sha = null;
    try {
      const existingFile = await githubRequest(`/contents/${filePath}`);
      if (existingFile && existingFile.sha) {
        sha = existingFile.sha;
        log(`File exists, will update: ${filePath}`);
      }
    } catch (error) {
      // File doesn't exist, will create it
      log(`File does not exist yet, will create: ${filePath}`);
    }
    
    // Get file content
    const content = getFileContent(filePath);
    if (!content) {
      log(`Failed to read file content: ${filePath}`, 'error');
      return false;
    }
    
    // Create or update file
    const data = {
      message: `Upload file: ${filePath}`,
      content: content,
      branch: BRANCH
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    const response = await githubRequest(`/contents/${filePath}`, 'PUT', data);
    
    if (response.status === 200 || response.status === 201) {
      log(`Successfully uploaded: ${filePath}`, 'success');
      return true;
    } else {
      log(`Failed to upload: ${filePath}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Error uploading file ${filePath}: ${error.message}`, 'error');
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

// Function to upload essential files
async function uploadEssentialFiles(essentialPaths) {
  try {
    // Check if repository exists and is accessible
    const repoExists = await checkRepository();
    if (!repoExists) {
      log('Repository not accessible. Exiting.', 'error');
      return false;
    }
    
    // Upload each file
    let successCount = 0;
    let failureCount = 0;
    
    for (const filePath of essentialPaths) {
      // Ensure directory structure exists for this file
      await createDirectoryStructure(filePath);
      
      // Upload the file
      const success = await uploadFile(filePath);
      
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
    log('Starting essential files upload...');
    
    // Filter for files that exist
    const { existingFiles, missingFiles } = filterExistingFiles(ESSENTIAL_PATHS);
    
    if (missingFiles.length > 0) {
      log(`The following files are missing and will be skipped: ${missingFiles.join(', ')}`, 'warning');
    }
    
    log(`Found ${existingFiles.length} out of ${ESSENTIAL_PATHS.length} essential files`);
    
    // Upload essential files
    await uploadEssentialFiles(existingFiles);
    
    log('Essential files upload process completed', 'success');
  } catch (error) {
    log(`Unhandled error: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();