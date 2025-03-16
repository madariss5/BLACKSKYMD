/**
 * GitHub Permissions Checker
 * A utility to check the permissions of your GitHub token
 */

const axios = require('axios');

// Configuration
const token = process.env.GITHUB_TOKEN;
const owner = 'madariss5'; // Your GitHub username
const repo = 'BLACKSKY';    // Your repository name

// Color codes for terminal output
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

// GitHub API base URL
const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

// Log formatted message
function log(message, color = 'blue') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Make an API request to GitHub
async function makeRequest(url, method = 'GET', data = null) {
  try {
    const response = await axios({
      method,
      url: url.startsWith('http') ? url : `${baseUrl}${url}`,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      return {
        error: true,
        status: error.response.status,
        message: error.response.data.message,
        response: error.response.data
      };
    }
    
    return {
      error: true,
      message: error.message
    };
  }
}

// Check token permissions
async function checkPermissions() {
  log('='.repeat(50), 'cyan');
  log('  🔑 GITHUB TOKEN PERMISSIONS CHECKER', 'cyan');
  log('='.repeat(50), 'cyan');
  
  // Verify token works at all
  log('\n📝 Verifying token...', 'yellow');
  
  const repoInfo = await makeRequest('');
  
  if (repoInfo.error) {
    log('❌ Token verification failed!', 'red');
    log(`Error: ${repoInfo.message}`, 'red');
    log(`Status: ${repoInfo.status}`, 'red');
    return;
  }
  
  log('✅ Token is valid and can access the repository!', 'green');
  
  // Display basic repository info
  log('\n📂 Repository Information:', 'magenta');
  log(`Repository: ${owner}/${repo}`, 'cyan');
  log(`Description: ${repoInfo.description || 'No description'}`, 'cyan');
  log(`Visibility: ${repoInfo.private ? 'Private' : 'Public'}`, 'cyan');
  log(`Default branch: ${repoInfo.default_branch}`, 'cyan');
  
  // Check read access
  log('\n🔍 Checking read permissions...', 'yellow');
  
  // Check contents
  const contents = await makeRequest('/contents');
  log(`Repository contents: ${contents.error ? '❌ No access' : '✅ Can read'}`, contents.error ? 'red' : 'green');
  
  // Check issues
  const issues = await makeRequest('/issues');
  log(`Issues: ${issues.error ? '❌ No access' : '✅ Can read'}`, issues.error ? 'red' : 'green');
  
  // Check write access
  log('\n✏️ Checking write permissions...', 'yellow');
  
  // First check collaborator permissions
  const collaboration = await makeRequest(`/collaborators/${owner}/permission`);
  
  if (!collaboration.error) {
    log(`Your permission level: ${collaboration.permission}`, 'cyan');
    
    const canWrite = ['push', 'maintain', 'admin'].includes(collaboration.permission);
    log(`Write access: ${canWrite ? '✅ Yes' : '❌ No'}`, canWrite ? 'green' : 'red');
    
    const canAdmin = ['admin'].includes(collaboration.permission);
    log(`Admin access: ${canAdmin ? '✅ Yes' : '❌ No'}`, canAdmin ? 'green' : 'red');
  } else {
    log('Could not determine permission level from collaboration API', 'yellow');
    
    // Try to create a test file to verify write access
    log('\n📝 Testing write access by creating a test file...', 'yellow');
    
    const testContent = {
      message: "Testing write permissions",
      content: Buffer.from("This is a test file to verify GitHub token write permissions.").toString('base64'),
      branch: repoInfo.default_branch
    };
    
    const createResponse = await makeRequest('/contents/test-permissions-delete-me.md', 'PUT', testContent);
    
    if (createResponse.error) {
      log('❌ Write test failed! Your token does not have write permissions.', 'red');
      log(`Error: ${createResponse.message}`, 'red');
    } else {
      log('✅ Write test succeeded! Your token has write permissions.', 'green');
      
      // Try to delete the test file
      log('\n🗑️ Cleaning up test file...', 'yellow');
      
      const deleteContent = {
        message: "Removing test file",
        sha: createResponse.content.sha,
        branch: repoInfo.default_branch
      };
      
      const deleteResponse = await makeRequest('/contents/test-permissions-delete-me.md', 'DELETE', deleteContent);
      
      if (deleteResponse.error) {
        log('❓ Could not delete test file. You may need to remove it manually.', 'yellow');
      } else {
        log('✅ Test file deleted successfully.', 'green');
      }
    }
  }
  
  // Summarize
  log('\n📋 SUMMARY', 'magenta');
  log('-'.repeat(50), 'magenta');
  
  if (!collaboration.error) {
    log(`Your permission level: ${collaboration.permission}`, 'cyan');
  } else if (!createResponse || createResponse.error) {
    log('Your token appears to have READ-ONLY access to this repository.', 'yellow');
    log('For direct file editing, you need a token with write permissions.', 'yellow');
  } else {
    log('Your token has WRITE access to this repository.', 'green');
    log('You should be able to edit files and make commits.', 'green');
  }
  
  log('\n💡 How to fix permissions issues:', 'cyan');
  log('1. Go to https://github.com/settings/tokens', 'cyan');
  log('2. Create a new token with "repo" scope (full control)', 'cyan');
  log('3. Update your GITHUB_TOKEN environment variable', 'cyan');
  
  log('\n='.repeat(50), 'cyan');
}

// Run the permissions check
checkPermissions().catch(error => {
  log(`\n❌ ERROR: ${error.message}`, 'red');
});