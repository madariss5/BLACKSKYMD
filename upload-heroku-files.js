/**
 * Heroku Deployment Files Uploader for GitHub
 * This script uploads only the essential files needed for Heroku deployment
 */

const fs = require('fs');
const path = require('path');

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'madariss5';
const REPO = 'BLACKSKYMD';
const BRANCH = 'main';

// List of essential files for Heroku deployment
const ESSENTIAL_FILES = [
  'app.json',
  'Procfile',
  'heroku.yml',
  'Dockerfile',
  '.slugignore',
  'package.json',
  'src/cloud-qr-server.js',
  'src/heroku-session-restore.js',
  'src/index.js',
  'src/qr-web-server-fixed.js',
  'HEROKU_DEPLOYMENT.md',
  'CLOUD_ENVIRONMENT_GUIDE.md',
  'README.md'
];

// Function to log with colors
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',  // Blue
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m'  // Yellow
  };
  
  const colorCode = colors[type] || colors.info;
  const timestamp = new Date().toISOString();
  console.log(`${colorCode}[${timestamp}] [${type.toUpperCase()}] ${message}\x1b[0m`);
}

// Check if file exists
function fileExistsSync(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

// Filter paths that exist in the filesystem
function filterExistingFiles(paths) {
  return paths.filter(p => fileExistsSync(p));
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

// Function to create the repository if it doesn't exist
async function createRepository() {
  try {
    log(`Creating repository: ${OWNER}/${REPO}`);
    
    const data = {
      name: REPO,
      description: 'BLACKSKY-MD WhatsApp Bot - Optimized for Heroku Deployment',
      private: false,
      auto_init: true
    };
    
    const response = await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'BLACKSKYMD-Upload-Script',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create repository: ${errorText}`);
    }
    
    log(`Repository created successfully: ${OWNER}/${REPO}`, 'success');
    return true;
  } catch (error) {
    log(`Error creating repository: ${error.message}`, 'error');
    return false;
  }
}

// Function to read a file and convert to base64
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
    
    // Read file content
    const contentEncoded = getFileContent(filePath);
    if (!contentEncoded) {
      return false;
    }
    
    // Create or update file
    const data = {
      message: `Update essential file for Heroku deployment: ${filePath}`,
      content: contentEncoded,
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
      const response = await githubRequest(`/contents/${checkPath}`);
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
            content: '',
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

// Function to upload all essential files
async function uploadEssentialFiles(essentialPaths) {
  try {
    // Check if repository exists and is accessible
    let repoExists = await checkRepository();
    if (!repoExists) {
      // Try to create the repository
      const created = await createRepository();
      if (!created) {
        log('Failed to create repository. Exiting.', 'error');
        return false;
      }
      repoExists = true;
    }
    
    log(`Uploading ${essentialPaths.length} essential files for Heroku deployment`);
    
    if (essentialPaths.length === 0) {
      log('No essential files found to upload. Exiting.', 'warning');
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
    log('Starting Heroku deployment files upload...');
    
    // Filter to only include files that exist
    const existingFiles = filterExistingFiles(ESSENTIAL_FILES);
    log(`Found ${existingFiles.length} out of ${ESSENTIAL_FILES.length} essential files`);
    
    // Upload the essential files
    await uploadEssentialFiles(existingFiles);
    
    // Additional files from command-line arguments
    const additionalFiles = process.argv.slice(2);
    if (additionalFiles.length > 0) {
      log(`Processing ${additionalFiles.length} additional files from command-line arguments`);
      const existingAdditionalFiles = filterExistingFiles(additionalFiles);
      await uploadEssentialFiles(existingAdditionalFiles);
    }
    
    log('Heroku deployment files upload process completed', 'success');
  } catch (error) {
    log(`Unhandled error: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();