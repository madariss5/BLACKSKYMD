/**
 * GitHub Repository Permissions Fix
 * This script helps diagnose and fix permission issues with GitHub repositories
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_URL = "https://github.com/madariss5/BLACKSKY.git";
const REPO_OWNER = "madariss5";
const REPO_NAME = "BLACKSKY";

// ANSI color codes for output
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

// Helper function to log messages to console
function log(message, type = 'info') {
  let coloredMessage = message;
  
  switch (type) {
    case 'success':
      coloredMessage = `${COLORS.green}${message}${COLORS.reset}`;
      break;
    case 'warning':
      coloredMessage = `${COLORS.yellow}${message}${COLORS.reset}`;
      break;
    case 'error':
      coloredMessage = `${COLORS.red}${message}${COLORS.reset}`;
      break;
    case 'info':
      coloredMessage = `${COLORS.blue}${message}${COLORS.reset}`;
      break;
    case 'header':
      coloredMessage = `${COLORS.cyan}${COLORS.bright}${message}${COLORS.reset}`;
      break;
  }
  
  console.log(coloredMessage);
}

// Execute a shell command and return a promise
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    log(`Executing: ${command}`, 'info');
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log(`Error: ${error.message}`, 'error');
        reject(error);
        return;
      }
      
      if (stderr && !stderr.includes('warning:')) {
        log(`Command output (stderr): ${stderr}`, 'warning');
      }
      
      if (stdout) {
        log(`Command output: ${stdout}`, 'info');
      }
      
      resolve({ stdout, stderr });
    });
  });
}

// Make an HTTP request to GitHub API
function makeGitHubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'GitHub-Permission-Fix-Script',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    if (data) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = JSON.stringify(data).length;
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          log(`API request failed with status code ${res.statusCode}: ${responseData}`, 'error');
          reject(new Error(`API request failed: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      log(`API request error: ${error.message}`, 'error');
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Check user permissions on the repository
async function checkRepositoryPermissions() {
  log('Checking your permissions on the repository...', 'info');
  
  try {
    const repo = await makeGitHubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}`);
    
    log(`Repository owner: ${repo.owner.login}`, 'info');
    log(`Repository name: ${repo.name}`, 'info');
    log(`Repository visibility: ${repo.visibility}`, 'info');
    log(`Repository permissions:`, 'info');
    
    if (repo.permissions) {
      const permissions = repo.permissions;
      log(`  - Admin: ${permissions.admin ? 'Yes' : 'No'}`, permissions.admin ? 'success' : 'warning');
      log(`  - Push (write): ${permissions.push ? 'Yes' : 'No'}`, permissions.push ? 'success' : 'warning');
      log(`  - Pull (read): ${permissions.pull ? 'Yes' : 'No'}`, permissions.pull ? 'success' : 'warning');
    } else {
      log('Could not determine your permissions on this repository.', 'warning');
    }
    
    // Check if you're the owner
    const isOwner = repo.owner.login === await getCurrentUser();
    log(`You are ${isOwner ? '' : 'not '}the owner of this repository.`, isOwner ? 'success' : 'info');
    
    return repo.permissions;
  } catch (error) {
    log('Failed to check repository permissions.', 'error');
    throw error;
  }
}

// Get current authenticated user
async function getCurrentUser() {
  try {
    const user = await makeGitHubRequest('/user');
    log(`Authenticated as: ${user.login}`, 'success');
    return user.login;
  } catch (error) {
    log('Failed to get current user.', 'error');
    throw error;
  }
}

// List collaborators on the repository
async function listCollaborators() {
  log(`Listing collaborators on ${REPO_OWNER}/${REPO_NAME}...`, 'info');
  
  try {
    const collaborators = await makeGitHubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/collaborators`);
    
    if (collaborators.length === 0) {
      log('No collaborators found.', 'warning');
    } else {
      log(`Found ${collaborators.length} collaborators:`, 'success');
      
      for (const collab of collaborators) {
        log(`  - ${collab.login} (${collab.permissions ? 
          (collab.permissions.admin ? 'Admin' : 
            (collab.permissions.push ? 'Write' : 'Read')
          ) : 'Unknown permissions'})`, 'info');
      }
    }
    
    return collaborators;
  } catch (error) {
    log('Failed to list collaborators.', 'error');
    throw error;
  }
}

// Check branch protection rules
async function checkBranchProtection() {
  log(`Checking branch protection rules for the main branch...`, 'info');
  
  try {
    const protection = await makeGitHubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/branches/main/protection`);
    
    log('Branch protection is enabled.', 'warning');
    log('This might prevent you from pushing directly to the main branch.', 'warning');
    
    return protection;
  } catch (error) {
    if (error.message.includes('Not Found')) {
      log('No branch protection rules found. You should be able to push directly.', 'success');
      return null;
    }
    
    log('Failed to check branch protection.', 'error');
    throw error;
  }
}

// List permissions issues and suggest fixes
async function suggestPermissionFixes(permissions) {
  log('Analyzing repository permissions...', 'info');
  
  const issues = [];
  
  if (!permissions) {
    issues.push({
      issue: 'Could not determine your permissions on this repository.',
      fix: 'Make sure your GitHub token has the correct scopes (repo, write:repo_hook).'
    });
  } else {
    if (!permissions.push) {
      issues.push({
        issue: 'You do not have write permission on this repository.',
        fix: 'The repository owner needs to grant you write or admin permission.'
      });
    }
    
    if (!permissions.admin) {
      issues.push({
        issue: 'You do not have admin permission on this repository.',
        fix: 'For full control, the repository owner needs to grant you admin permission.'
      });
    }
  }
  
  try {
    // Check if branch protection might be causing issues
    const protection = await checkBranchProtection();
    if (protection) {
      issues.push({
        issue: 'Branch protection is enabled on the main branch.',
        fix: 'Disable branch protection or create a pull request instead of pushing directly.'
      });
    }
    
    // Check if user is using the correct remote URL
    const { stdout } = await executeCommand('git remote -v');
    if (!stdout.includes(REPO_URL) && !stdout.includes(REPO_URL.replace('.git', ''))) {
      issues.push({
        issue: 'Your git remote URL might be incorrect.',
        fix: `Set the correct remote URL: git remote set-url origin ${REPO_URL}`
      });
    }
  } catch (error) {
    // Continue even if these checks fail
  }
  
  // Display issues and fixes
  if (issues.length === 0) {
    log('No permission issues found. You should be able to push to this repository.', 'success');
  } else {
    log(`Found ${issues.length} potential issues:`, 'warning');
    
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      log(`Issue ${i + 1}: ${issue.issue}`, 'warning');
      log(`Fix: ${issue.fix}`, 'info');
      log('');
    }
  }
  
  return issues;
}

// Verify GitHub token
async function verifyGitHubToken() {
  log('Verifying GitHub token...', 'info');
  
  if (!GITHUB_TOKEN) {
    log('GitHub token not found. Please set the GITHUB_TOKEN environment variable.', 'error');
    return false;
  }
  
  try {
    const { login, scopes } = await makeGitHubRequest('/user');
    
    log(`Token is valid. Authenticated as: ${login}`, 'success');
    
    if (scopes) {
      log(`Token scopes: ${scopes}`, 'info');
      
      // Check if the token has the necessary scopes
      const hasRepoScope = scopes.includes('repo');
      log(`  - Has repo scope: ${hasRepoScope ? 'Yes' : 'No'}`, hasRepoScope ? 'success' : 'warning');
      
      if (!hasRepoScope) {
        log('Your token does not have the repo scope, which is needed for full repository access.', 'warning');
        log('Generate a new token with the repo scope at https://github.com/settings/tokens', 'info');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    log('Failed to verify GitHub token. It might be invalid or expired.', 'error');
    return false;
  }
}

// Add a new collaborator to the repository
async function addCollaborator(username, permission = 'push') {
  log(`Adding ${username} as a collaborator with ${permission} permission...`, 'info');
  
  try {
    const response = await makeGitHubRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/collaborators/${username}`, 
      'PUT', 
      { permission: permission }
    );
    
    log(`Invitation sent to ${username}.`, 'success');
    return response;
  } catch (error) {
    log(`Failed to add ${username} as a collaborator.`, 'error');
    throw error;
  }
}

// Main function
async function main() {
  log('================================================', 'header');
  log('       GitHub Repository Permissions Fix        ', 'header');
  log('================================================', 'header');
  
  try {
    // Verify GitHub token
    const isTokenValid = await verifyGitHubToken();
    if (!isTokenValid) {
      log('Please fix your GitHub token and try again.', 'error');
      return;
    }
    
    // Check repository permissions
    const permissions = await checkRepositoryPermissions();
    
    // List collaborators
    await listCollaborators();
    
    // Suggest permission fixes
    const issues = await suggestPermissionFixes(permissions);
    
    if (issues.length === 0) {
      // Test creating a file to verify permissions
      log('Your permissions look good. Testing file creation...', 'info');
      
      try {
        await makeGitHubRequest(
          `/repos/${REPO_OWNER}/${REPO_NAME}/contents/test-permissions.md`,
          'PUT',
          {
            message: 'Test permissions - creating file',
            content: Buffer.from('# Testing GitHub Permissions\n\nThis file was created to test your GitHub permissions.').toString('base64')
          }
        );
        
        log('Successfully created a test file in the repository.', 'success');
        
        // Delete the test file
        const fileInfo = await makeGitHubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/test-permissions.md`);
        
        await makeGitHubRequest(
          `/repos/${REPO_OWNER}/${REPO_NAME}/contents/test-permissions.md`,
          'DELETE',
          {
            message: 'Test permissions - deleting file',
            sha: fileInfo.sha
          }
        );
        
        log('Successfully deleted the test file.', 'success');
        log('You have all the necessary permissions to edit this repository.', 'success');
      } catch (error) {
        log('Could not create/delete a test file in the repository.', 'error');
        log('You might have issues with direct file editing on GitHub.', 'warning');
      }
    }
    
    log('================================================', 'header');
    log('Would you like to add a collaborator to the repository? (y/n)', 'info');
    
    process.stdin.on('data', async (data) => {
      const input = data.toString().trim().toLowerCase();
      
      if (input === 'y' || input === 'yes') {
        log('Enter the GitHub username of the collaborator:', 'info');
        
        process.stdin.once('data', async (usernameData) => {
          const username = usernameData.toString().trim();
          
          log('Enter permission level (read, write, admin):', 'info');
          
          process.stdin.once('data', async (permissionData) => {
            const permission = permissionData.toString().trim().toLowerCase();
            
            if (['read', 'write', 'admin'].includes(permission)) {
              try {
                await addCollaborator(username, permission === 'read' ? 'pull' : permission);
                
                log('================================================', 'header');
                log('GitHub permissions check completed!', 'success');
                log('================================================', 'header');
                
                process.exit(0);
              } catch (error) {
                log('Failed to add collaborator.', 'error');
                process.exit(1);
              }
            } else {
              log('Invalid permission level.', 'error');
              process.exit(1);
            }
          });
        });
      } else {
        log('================================================', 'header');
        log('GitHub permissions check completed!', 'success');
        log('================================================', 'header');
        
        process.exit(0);
      }
    });
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();