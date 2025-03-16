/**
 * GitHub Token Permission Fix
 * 
 * This utility helps generate instructions to fix GitHub token permission issues
 * providing detailed guidance on how to obtain a token with write access.
 */

const axios = require('axios');

// Configuration
const config = {
  token: process.env.GITHUB_TOKEN,
  owner: 'madariss5',  // Repository owner username
  repo: 'BLACKSKY',     // Repository name
  tokenUrl: 'https://github.com/settings/tokens'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Log a message with color
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Make a GitHub API request
async function makeGitHubRequest(endpoint, method = 'GET', data = null) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.github.com/repos/${config.owner}/${config.repo}${endpoint}`;
  
  try {
    const response = await axios({
      method,
      url,
      headers: {
        Authorization: `token ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  } catch (error) {
    return {
      error: true,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    };
  }
}

// Check basic repository access
async function checkRepositoryAccess() {
  log('\n🔍 Checking repository access...', 'cyan');
  
  const result = await makeGitHubRequest('');
  
  if (result.error) {
    log(`❌ Cannot access repository: ${result.message}`, 'red');
    return false;
  }
  
  log(`✅ Successfully accessed repository: ${config.owner}/${config.repo}`, 'green');
  return true;
}

// Check permission level for the token
async function checkPermissionLevel() {
  log('\n🔍 Checking permission level...', 'cyan');
  
  // Try to get collaborator permission explicitly
  const collaborator = await makeGitHubRequest(`/collaborators/${config.owner}/permission`);
  
  if (!collaborator.error) {
    const permission = collaborator.permission;
    log(`👤 Permission level: ${permission}`, 'yellow');
    
    const canWrite = ['push', 'maintain', 'admin'].includes(permission);
    log(`✍️ Write access: ${canWrite ? '✅ Yes' : '❌ No'}`, canWrite ? 'green' : 'red');
    
    return { canWrite, permission };
  }
  
  // If we couldn't determine from collaborator API, try to create a test file
  log('\n🧪 Testing write permissions by creating a test file...', 'cyan');
  
  const testContent = {
    message: 'Testing token write permissions',
    content: Buffer.from('This is a temporary test file to verify write permissions.').toString('base64'),
    branch: 'main'
  };
  
  const createResult = await makeGitHubRequest('/contents/test-token-permissions.md', 'PUT', testContent);
  
  if (createResult.error) {
    log(`❌ Write test failed: ${createResult.message}`, 'red');
    return { canWrite: false, permission: 'read' };
  }
  
  log('✅ Successfully created test file', 'green');
  
  // Clean up test file
  if (createResult.content?.sha) {
    log('🧹 Cleaning up test file...', 'cyan');
    
    const deleteContent = {
      message: 'Removing test token permissions file',
      sha: createResult.content.sha
    };
    
    const deleteResult = await makeGitHubRequest('/contents/test-token-permissions.md', 'DELETE', deleteContent);
    
    if (deleteResult.error) {
      log(`⚠️ Could not delete test file: ${deleteResult.message}`, 'yellow');
    } else {
      log('✅ Test file deleted successfully', 'green');
    }
  }
  
  return { canWrite: true, permission: 'write' };
}

// Generate instructions for fixing token permissions
function generateTokenInstructions() {
  log('\n📝 INSTRUCTIONS TO FIX TOKEN PERMISSIONS', 'magenta');
  log('='.repeat(50), 'magenta');
  
  log('\n1️⃣ Go to GitHub Personal Access Tokens page:', 'white');
  log(`   ${config.tokenUrl}`, 'cyan');
  
  log('\n2️⃣ Click on "Generate new token" > "Generate new token (classic)"', 'white');
  
  log('\n3️⃣ Fill in the following information:', 'white');
  log('   • Note: WhatsApp Bot GitHub Access', 'yellow');
  log('   • Expiration: Select an appropriate expiration date (90 days recommended)', 'yellow');
  
  log('\n4️⃣ Select the following permissions:', 'white');
  log('   • ✅ repo - Full control of private repositories', 'green');
  log('     (This includes repo:status, repo_deployment, public_repo, repo:invite, security_events)', 'dim');
  
  log('\n5️⃣ Click "Generate token" at the bottom of the page', 'white');
  
  log('\n6️⃣ Copy your new token (IMPORTANT! You can only see it once)', 'white');
  
  log('\n7️⃣ Update the GITHUB_TOKEN environment variable in your Replit environment', 'white');
  log('   • Set Name: GITHUB_TOKEN', 'yellow');
  log('   • Set Value: [Your copied token]', 'yellow');
  
  log('\n⚠️  WARNING: The token provides write access to your repositories.', 'red');
  log('   Never share it or commit it to version control.', 'red');
  
  log('\n✅ After updating the token, run this script again to verify the permissions.', 'green');
}

// Main function
async function main() {
  log('\n🔐 GITHUB TOKEN PERMISSION CHECKER', 'cyan');
  log('='.repeat(50), 'cyan');
  
  if (!config.token) {
    log('❌ ERROR: No GitHub token found. Set the GITHUB_TOKEN environment variable.', 'red');
    process.exit(1);
  }
  
  log(`🔗 Repository: ${config.owner}/${config.repo}`, 'yellow');
  log(`🔑 Token: ${config.token.substring(0, 4)}...${config.token.substring(config.token.length - 4)}`, 'yellow');
  
  const hasAccess = await checkRepositoryAccess();
  
  if (!hasAccess) {
    log('\n❌ Your token does not have access to this repository.', 'red');
    generateTokenInstructions();
    process.exit(1);
  }
  
  const { canWrite, permission } = await checkPermissionLevel();
  
  log('\n📊 PERMISSION SUMMARY', 'magenta');
  log('='.repeat(50), 'magenta');
  log(`🔑 Token: ${config.token.substring(0, 4)}...${config.token.substring(config.token.length - 4)}`, 'white');
  log(`👤 Permission level: ${permission}`, 'white');
  log(`✍️ Write access: ${canWrite ? '✅ Yes' : '❌ No'}`, canWrite ? 'green' : 'red');
  
  if (!canWrite) {
    log('\n❌ Your token does not have write access to this repository.', 'red');
    log('  To edit files directly on GitHub, you need a token with write permissions.', 'yellow');
    generateTokenInstructions();
  } else {
    log('\n✅ Your token has write access to this repository!', 'green');
    log('  You can use this token to edit files directly on GitHub.', 'green');
  }
}

// Run the program
main().catch(error => {
  log(`\n❌ ERROR: ${error.message}`, 'red');
});