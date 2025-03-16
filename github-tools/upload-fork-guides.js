/**
 * Upload Fork Guides Utility
 * Automatically uploads fork-related guide files to the GitHub repository
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const readline = require('readline');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_INFO = process.env.GITHUB_REPOSITORY || 'madariss5/BLACKSKY';
const [OWNER, REPO] = REPO_INFO.split('/');

// Guide files to upload
const GUIDE_FILES = [
  {
    localPath: path.join(__dirname, '..', 'FORK_GUIDE.md'),
    repoPath: 'FORK_GUIDE.md',
    description: 'Repository Forking Guide for Users'
  },
  {
    localPath: path.join(__dirname, '..', 'ENABLING_FORKS.md'),
    repoPath: 'ENABLING_FORKS.md',
    description: 'Guide for Repository Owners on Enabling Forks'
  }
];

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simple prompt function
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Make a GitHub API request
function githubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    console.log(`Making ${method} request to ${endpoint}...`);
    
    const options = {
      hostname: 'api.github.com',
      path: endpoint.startsWith('/repos') 
        ? endpoint 
        : `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        'User-Agent': 'Fork-Guide-Upload-Utility',
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

// Verify GitHub token
async function verifyToken() {
  try {
    console.log('Verifying GitHub token...');
    const response = await githubRequest('');
    console.log(`Token verification successful. Connected to ${response.name}`);
    return true;
  } catch (error) {
    console.error(`Token verification failed: ${error.message}`);
    return false;
  }
}

// Check if a file exists in the repository
async function checkFileExists(filePath) {
  try {
    console.log(`Checking if ${filePath} exists in the repository...`);
    const response = await githubRequest(`/contents/${filePath}`);
    return { exists: true, sha: response.sha };
  } catch (error) {
    if (error.statusCode === 404) {
      return { exists: false, sha: null };
    }
    throw error;
  }
}

// Upload a file to the repository
async function uploadFile(filePath, content, message, sha = null) {
  try {
    const endpoint = `/contents/${filePath}`;
    const data = {
      message: message,
      content: Buffer.from(content).toString('base64')
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    console.log(`Uploading ${filePath} to the repository...`);
    const response = await githubRequest(endpoint, 'PUT', data);
    
    console.log(`✅ Successfully ${sha ? 'updated' : 'created'} ${filePath}`);
    return response;
  } catch (error) {
    console.error(`Error uploading ${filePath}: ${error.message}`);
    throw error;
  }
}

// Read a local file
async function readLocalFile(filePath) {
  try {
    console.log(`Reading local file: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Error reading local file ${filePath}: ${error.message}`);
    throw error;
  }
}

// Upload all guide files
async function uploadAllGuides() {
  console.log('\nUploading fork guide files to the repository...');
  
  for (const file of GUIDE_FILES) {
    try {
      console.log(`\nProcessing guide: ${file.description}`);
      
      // Read local file
      const content = await readLocalFile(file.localPath);
      
      // Check if file exists in repository
      const { exists, sha } = await checkFileExists(file.repoPath);
      
      // Upload file
      const message = exists
        ? `Update ${file.repoPath}: ${file.description}`
        : `Add ${file.repoPath}: ${file.description}`;
      
      await uploadFile(file.repoPath, content, message, sha);
    } catch (error) {
      console.error(`Failed to upload ${file.repoPath}: ${error.message}`);
    }
  }
  
  console.log('\nAll guides have been processed.');
}

// Main function
async function main() {
  try {
    console.log('=============================================');
    console.log('  FORK GUIDES UPLOAD UTILITY');
    console.log('  Upload fork-related guides to GitHub');
    console.log('=============================================\n');
    
    // Verify GitHub token
    const isTokenValid = await verifyToken();
    
    if (!isTokenValid) {
      console.log('GitHub token verification failed. Please check your token and permissions.');
      rl.close();
      return;
    }
    
    // Show repository info
    console.log(`Target repository: ${OWNER}/${REPO}`);
    
    // List files to be uploaded
    console.log('\nThe following guide files will be uploaded:');
    
    for (let i = 0; i < GUIDE_FILES.length; i++) {
      const file = GUIDE_FILES[i];
      console.log(`${i + 1}. ${file.repoPath}: ${file.description}`);
    }
    
    // Confirm upload
    const confirmUpload = await prompt('\nDo you want to upload these files to the repository? (y/n): ');
    
    if (confirmUpload.toLowerCase() === 'y') {
      await uploadAllGuides();
      console.log('\n✅ Guides upload process completed.');
    } else {
      console.log('\nUpload cancelled by user.');
    }
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
  console.log('\nExiting Fork Guides Upload Utility. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});