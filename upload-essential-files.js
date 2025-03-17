/**
 * Essential Files Uploader for GitHub
 * This script uploads only the essential files for the WhatsApp bot to GitHub
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration - Update with your repository details
const REPO_OWNER = 'madariss5';
const REPO_NAME = 'BLACKSKYMD';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

// Essential files to upload
const ESSENTIAL_FILES = [
  // Core files
  'src/connection.js',
  'src/cloud-qr-server.js',
  'src/qr-web-server-fixed.js',
  'src/direct-gif-fix.js',
  'src/index.js',
  
  // Config files
  'package.json',
  'Procfile',
  'app.json',
  'Dockerfile',
  'heroku.yml',
  'docker-compose.yml',
  '.env.example',
  
  // Documentation
  'README.md',
  'CLOUD_ENVIRONMENT_GUIDE.md',
  'HEROKU_SETUP_GUIDE.md',
  'REACTION_GIF_MATCHING_GUIDE.md',
  'DOCKER_DEPLOYMENT_GUIDE.md',
  'DEPLOY_TO_HEROKU.md',
  'DEPLOYMENT_GUIDE.md',
  
  // GitHub files
  'github-upload.js',
  'github-update.js'
];

// Helper function to check if file exists
function fileExistsSync(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Filter out files that don't exist
function filterExistingFiles(paths) {
  return paths.filter(p => fileExistsSync(p));
}

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

// Get file content and convert to base64
function getFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return content.toString('base64');
  } catch (error) {
    log(`Error reading file ${filePath}: ${error.message}`, 'error');
    throw error;
  }
}

// Upload a single file to GitHub
async function uploadFile(filePath) {
  try {
    log(`Uploading: ${filePath}...`);
    
    // Get base64 content
    const content = getFileContent(filePath);
    
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
      log(`File doesn't exist yet, will create: ${filePath}`, 'info');
    }
    
    // Check if we need to create directory structure
    const dirPath = path.dirname(filePath);
    if (dirPath !== '.' && dirPath !== '/') {
      await createDirectoryStructure(dirPath);
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
    log(`Failed to upload ${filePath}: ${error.message}`, 'error');
    return false;
  }
}

// Create directory structure (recursive)
async function createDirectoryStructure(filePath) {
  // Only proceed if the path has multiple levels
  if (!filePath.includes('/')) return;
  
  const parts = filePath.split('/');
  let currentPath = '';
  
  for (let i = 0; i < parts.length; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    
    // Skip checking the last part (which is the actual file)
    if (i === parts.length - 1) continue;
    
    try {
      // Check if directory exists already
      const checkResult = await githubRequest(`/contents/${currentPath}`);
      if (checkResult && !checkResult.error) {
        // Directory exists, continue
        continue;
      }
    } catch (error) {
      // Directory doesn't exist, we need to create a placeholder file
      try {
        log(`Creating directory structure: ${currentPath}`, 'info');
        
        // Create a .gitkeep file in the directory
        const result = await githubRequest(`/contents/${currentPath}/.gitkeep`, 'PUT', {
          message: `Create directory ${currentPath}`,
          content: 'Cg==', // Base64 for empty string
        });
        
        if (result && result.error) {
          throw new Error(result.error);
        }
      } catch (dirError) {
        // If we get a 422 error, the directory probably already exists
        if (!dirError.message.includes('422')) {
          log(`Warning: Could not create directory ${currentPath}: ${dirError.message}`, 'warning');
        }
      }
    }
  }
}

// Upload all essential files to GitHub
async function uploadEssentialFiles(essentialPaths) {
  try {
    log(`Starting upload of ${essentialPaths.length} essential files...`);
    
    // Upload files one by one
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < essentialPaths.length; i++) {
      const filePath = essentialPaths[i];
      log(`Processing file ${i + 1} of ${essentialPaths.length}: ${filePath}`, 'info');
      
      const success = await uploadFile(filePath);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
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
    
    log('Starting GitHub essential files upload process...', 'info');
    log(`Target: https://github.com/${REPO_OWNER}/${REPO_NAME}`, 'info');
    
    // Check if repository exists
    const repoExists = await checkRepository();
    
    // Create repository if it doesn't exist
    if (!repoExists) {
      await createRepository();
    }
    
    // Filter to only existing files
    const existingFiles = filterExistingFiles(ESSENTIAL_FILES);
    log(`Found ${existingFiles.length} essential files to upload.`, 'info');
    
    // Upload all essential files
    await uploadEssentialFiles(existingFiles);
    
    log('GitHub upload process completed successfully!', 'success');
    log(`Your repository is available at: https://github.com/${REPO_OWNER}/${REPO_NAME}`, 'success');
  } catch (error) {
    log(`GitHub upload process failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Execute main function
main();