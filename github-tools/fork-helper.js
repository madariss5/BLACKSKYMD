/**
 * Fork Helper Utility
 * Helps manage and track forks of your repository
 */

const https = require('https');
const readline = require('readline');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_INFO = process.env.GITHUB_REPOSITORY || 'madariss5/BLACKSKY';
const [OWNER, REPO] = REPO_INFO.split('/');

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
        'User-Agent': 'Fork-Helper-Utility',
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

// List forks of the repository
async function listForks() {
  try {
    console.log(`Listing forks for ${OWNER}/${REPO}...`);
    const forks = await githubRequest('/forks');
    
    if (forks.length === 0) {
      console.log('No forks found for this repository.');
    } else {
      console.log(`Found ${forks.length} fork(s):`);
      
      for (let i = 0; i < forks.length; i++) {
        const fork = forks[i];
        console.log(`\n${i + 1}. ${fork.owner.login}/${fork.name}`);
        console.log(`   - Created: ${new Date(fork.created_at).toLocaleString()}`);
        console.log(`   - Last updated: ${new Date(fork.updated_at).toLocaleString()}`);
        console.log(`   - Stars: ${fork.stargazers_count}`);
        console.log(`   - URL: ${fork.html_url}`);
      }
    }
    
    return forks;
  } catch (error) {
    console.error(`Error listing forks: ${error.message}`);
    return [];
  }
}

// Check if repository allows forking
async function checkForkSettings() {
  try {
    console.log(`Checking fork settings for ${OWNER}/${REPO}...`);
    const repo = await githubRequest('');
    
    console.log('\nFork Settings:');
    console.log(`- Allow forking: ${repo.allow_forking ? 'Enabled ✅' : 'Disabled ❌'}`);
    
    if (!repo.allow_forking) {
      console.log('\nTo enable forking:');
      console.log('1. Go to your repository on GitHub');
      console.log('2. Click on "Settings" in the top navigation bar');
      console.log('3. Scroll down to the "Features" section');
      console.log('4. Check the "Allow forking" checkbox');
      console.log('5. Click "Save changes"');
    }
    
    return repo.allow_forking;
  } catch (error) {
    console.error(`Error checking fork settings: ${error.message}`);
    return null;
  }
}

// Enable forking for the repository
async function enableForking() {
  try {
    console.log(`Enabling forking for ${OWNER}/${REPO}...`);
    
    const data = {
      allow_forking: true
    };
    
    await githubRequest('', 'PATCH', data);
    console.log('✅ Forking has been enabled for this repository.');
    return true;
  } catch (error) {
    console.error(`Error enabling forking: ${error.message}`);
    
    if (error.statusCode === 403) {
      console.log('\nPermission denied. You may not have sufficient permissions to change this setting.');
      console.log('Try going to the repository settings on GitHub directly:');
      console.log(`https://github.com/${OWNER}/${REPO}/settings`);
    }
    
    return false;
  }
}

// Check for potential pull requests from forks
async function checkPullRequests() {
  try {
    console.log(`Checking pull requests for ${OWNER}/${REPO}...`);
    const pullRequests = await githubRequest('/pulls?state=all');
    
    if (pullRequests.length === 0) {
      console.log('No pull requests found for this repository.');
    } else {
      const openPRs = pullRequests.filter(pr => pr.state === 'open');
      const closedPRs = pullRequests.filter(pr => pr.state === 'closed');
      
      console.log(`Found ${pullRequests.length} pull request(s):`);
      console.log(`- Open: ${openPRs.length}`);
      console.log(`- Closed: ${closedPRs.length}`);
      
      if (openPRs.length > 0) {
        console.log('\nOpen Pull Requests:');
        openPRs.forEach((pr, index) => {
          console.log(`\n${index + 1}. ${pr.title}`);
          console.log(`   - Submitted by: ${pr.user.login}`);
          console.log(`   - Created: ${new Date(pr.created_at).toLocaleString()}`);
          console.log(`   - URL: ${pr.html_url}`);
        });
      }
    }
    
    return pullRequests;
  } catch (error) {
    console.error(`Error checking pull requests: ${error.message}`);
    return [];
  }
}

// Check repository fork status
async function checkForkStatus() {
  try {
    console.log(`Checking if ${OWNER}/${REPO} is a fork...`);
    const repo = await githubRequest('');
    
    if (repo.fork) {
      console.log(`✅ This repository is a fork of ${repo.parent.full_name}`);
      console.log(`- Original repository: ${repo.parent.html_url}`);
      console.log(`- Original stars: ${repo.parent.stargazers_count}`);
      console.log(`- Original forks: ${repo.parent.forks_count}`);
      
      // Check if fork is behind the original
      try {
        const comparison = await githubRequest(`/compare/${repo.parent.owner.login}:${repo.parent.default_branch}...${OWNER}:${repo.default_branch}`);
        
        if (comparison.behind_by > 0) {
          console.log(`- Your fork is ${comparison.behind_by} commit(s) behind the original repository.`);
          console.log('- You might want to sync your fork to get the latest changes.');
        } else if (comparison.ahead_by > 0) {
          console.log(`- Your fork is ${comparison.ahead_by} commit(s) ahead of the original repository.`);
          console.log('- Consider submitting a pull request to contribute back your changes.');
        } else {
          console.log('- Your fork is up to date with the original repository.');
        }
      } catch (error) {
        console.error(`Error comparing repositories: ${error.message}`);
      }
    } else {
      console.log('⚠️ This repository is not a fork. It is an original repository.');
    }
    
    return repo.fork;
  } catch (error) {
    console.error(`Error checking fork status: ${error.message}`);
    return null;
  }
}

// View fork network
async function viewForkNetwork() {
  try {
    console.log(`Examining fork network for ${OWNER}/${REPO}...`);
    
    // Get repository info first to determine if it's a fork
    const repo = await githubRequest('');
    let rootRepo = repo;
    
    // If this is a fork, get the root repository
    if (repo.fork && repo.parent) {
      rootRepo = await githubRequest(`/repos/${repo.parent.full_name}`);
      console.log(`This repository is a fork of ${rootRepo.full_name}`);
    }
    
    // Get all forks of the root repository
    const forks = await githubRequest(`/repos/${rootRepo.full_name}/forks`);
    
    console.log(`\nFork Network for ${rootRepo.full_name}:`);
    console.log(`- Root repository: ${rootRepo.html_url}`);
    console.log(`- Total forks: ${rootRepo.forks_count}`);
    
    if (forks.length === 0) {
      console.log('- No forks found in the network.');
    } else {
      console.log(`\nLatest active forks (${Math.min(forks.length, 10)} of ${rootRepo.forks_count}):`);
      
      // Sort forks by last update and show the most recent
      const sortedForks = forks.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      
      for (let i = 0; i < Math.min(sortedForks.length, 10); i++) {
        const fork = sortedForks[i];
        console.log(`\n${i + 1}. ${fork.owner.login}/${fork.name}`);
        console.log(`   - Last updated: ${new Date(fork.updated_at).toLocaleString()}`);
        console.log(`   - Stars: ${fork.stargazers_count}`);
        console.log(`   - URL: ${fork.html_url}`);
      }
    }
    
    return { rootRepo, forks };
  } catch (error) {
    console.error(`Error viewing fork network: ${error.message}`);
    return { rootRepo: null, forks: [] };
  }
}

// Main menu
async function mainMenu() {
  while (true) {
    console.log('\n===============================');
    console.log('  FORK HELPER UTILITY');
    console.log(`  Repository: ${OWNER}/${REPO}`);
    console.log('===============================\n');
    
    console.log('1. List repository forks');
    console.log('2. Check fork settings');
    console.log('3. Enable forking for repository');
    console.log('4. Check pull requests from forks');
    console.log('5. Check if this repository is a fork');
    console.log('6. View fork network');
    console.log('7. Verify GitHub token');
    console.log('0. Exit\n');
    
    const choice = await prompt('Enter your choice: ');
    
    switch (choice) {
      case '1':
        await listForks();
        break;
      case '2':
        await checkForkSettings();
        break;
      case '3':
        await enableForking();
        break;
      case '4':
        await checkPullRequests();
        break;
      case '5':
        await checkForkStatus();
        break;
      case '6':
        await viewForkNetwork();
        break;
      case '7':
        await verifyToken();
        break;
      case '0':
        console.log('Exiting Fork Helper Utility. Goodbye!');
        rl.close();
        return;
      default:
        console.log('Invalid choice. Please try again.');
    }
    
    await prompt('\nPress Enter to continue...');
  }
}

// Main function
async function main() {
  try {
    console.log('=============================================');
    console.log('  FORK HELPER UTILITY');
    console.log('  Helps manage and track repository forks');
    console.log('=============================================\n');
    
    // Verify GitHub token
    const isTokenValid = await verifyToken();
    
    if (!isTokenValid) {
      console.log('GitHub token verification failed. Please check your token and permissions.');
      rl.close();
      return;
    }
    
    // Start the main menu
    await mainMenu();
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
  console.log('\nExiting Fork Helper Utility. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});