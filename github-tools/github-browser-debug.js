/**
 * GitHub Browser Debugging Tool
 * This script helps diagnose and fix common browser issues when editing files on GitHub
 */

const https = require('https');
const readline = require('readline');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'madariss5'; // Your GitHub username
const REPO = 'BLACKSKY'; // Your repository name

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function for logging with colors
function log(message, type = 'info') {
  const styles = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[SUCCESS]${colors.reset}`,
    warning: `${colors.yellow}[WARNING]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`,
    title: `${colors.cyan}${colors.bold}`,
    section: `${colors.yellow}${colors.bold}`,
    input: `${colors.green}> ${colors.reset}`,
  };

  console.log(`${styles[type]} ${message}`);
}

// Make a request to the GitHub API
function makeGitHubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        'User-Agent': 'GitHub-Browser-Debug',
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
          reject({
            statusCode: res.statusCode,
            message: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Verify GitHub token
async function verifyGitHubToken() {
  try {
    const response = await makeGitHubRequest('', 'GET');
    log(`Token verification successful. Repository: ${response.name}`, 'success');
    return true;
  } catch (error) {
    log(`Token verification failed: ${error.message}`, 'error');
    return false;
  }
}

// Check GitHub status
async function checkGitHubStatus() {
  log('Checking GitHub status...', 'info');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.githubstatus.com',
        path: '/api/v2/status.json',
        method: 'GET'
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.end();
    });
    
    const status = response.status.description;
    const indicator = response.status.indicator;
    
    if (indicator === 'none') {
      log(`GitHub status: ${status}`, 'success');
      return true;
    } else {
      log(`GitHub status: ${status} (${indicator})`, 'warning');
      log('GitHub may be experiencing issues. Check https://www.githubstatus.com/ for more details.', 'warning');
      return false;
    }
  } catch (error) {
    log(`Error checking GitHub status: ${error.message}`, 'error');
    return false;
  }
}

// Check network connectivity
function checkNetworkConnectivity() {
  log('Checking network connectivity...', 'info');
  
  try {
    execSync('ping -c 1 github.com', { stdio: 'ignore' });
    log('Network connectivity to GitHub is working.', 'success');
    return true;
  } catch (error) {
    log('Network connectivity issues detected. Cannot reach GitHub.', 'error');
    return false;
  }
}

// Check DNS resolution
function checkDNS() {
  log('Checking DNS resolution...', 'info');
  
  try {
    const result = execSync('nslookup github.com').toString();
    log('DNS resolution for GitHub is working.', 'success');
    return true;
  } catch (error) {
    log('DNS resolution issues detected.', 'error');
    return false;
  }
}

// Check network latency
function checkNetworkLatency() {
  log('Checking network latency to GitHub...', 'info');
  
  try {
    const result = execSync('ping -c 5 github.com').toString();
    const match = result.match(/min\/avg\/max(?:\/mdev)? = ([0-9.]+)\/([0-9.]+)\/([0-9.]+)/);
    
    if (match) {
      const avgLatency = parseFloat(match[2]);
      if (avgLatency < 100) {
        log(`Network latency to GitHub is good: ${avgLatency.toFixed(2)}ms average.`, 'success');
        return true;
      } else if (avgLatency < 300) {
        log(`Network latency to GitHub is moderate: ${avgLatency.toFixed(2)}ms average.`, 'warning');
        return true;
      } else {
        log(`Network latency to GitHub is high: ${avgLatency.toFixed(2)}ms average.`, 'error');
        return false;
      }
    } else {
      log('Could not determine network latency.', 'warning');
      return true;
    }
  } catch (error) {
    log('Error checking network latency.', 'error');
    return false;
  }
}

// Check system resources
function checkSystemResources() {
  log('Checking system resources...', 'info');
  
  const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const memoryUsage = 100 - Math.round((freeMemMB / totalMemMB) * 100);
  
  log(`Memory usage: ${memoryUsage}% (${freeMemMB}MB free / ${totalMemMB}MB total)`, memoryUsage > 90 ? 'error' : memoryUsage > 70 ? 'warning' : 'success');
  
  const cpuLoad = os.loadavg()[0];
  const cpuCores = os.cpus().length;
  const cpuUsage = Math.round((cpuLoad / cpuCores) * 100);
  
  log(`CPU usage: ${cpuUsage}% (${cpuLoad.toFixed(2)} load average, ${cpuCores} cores)`, cpuUsage > 90 ? 'error' : cpuUsage > 70 ? 'warning' : 'success');
  
  return { memoryOk: memoryUsage < 90, cpuOk: cpuUsage < 90 };
}

// Generate browser reset instructions
function generateBrowserResetInstructions(browserName) {
  console.log('\n' + colors.yellow + colors.bold + `Reset Instructions for ${browserName}:` + colors.reset);
  
  if (browserName.toLowerCase().includes('chrome')) {
    console.log(colors.dim + '1. Open Chrome and click the three dots in the top-right corner');
    console.log('2. Select "Settings"');
    console.log('3. Scroll down and click on "Advanced"');
    console.log('4. Find "Privacy and security" and click "Clear browsing data"');
    console.log('5. Select "Cookies and site data" and "Cached images and files"');
    console.log('6. Click "Clear data"' + colors.reset);
  } else if (browserName.toLowerCase().includes('firefox')) {
    console.log(colors.dim + '1. Open Firefox and click the menu button (three lines) in the top-right');
    console.log('2. Select "Options" or "Preferences"');
    console.log('3. Select "Privacy & Security"');
    console.log('4. Scroll to "Cookies and Site Data" and click "Clear Data..."');
    console.log('5. Select "Cookies and Site Data" and "Cached Web Content"');
    console.log('6. Click "Clear"' + colors.reset);
  } else if (browserName.toLowerCase().includes('edge')) {
    console.log(colors.dim + '1. Open Edge and click the three dots in the top-right corner');
    console.log('2. Select "Settings"');
    console.log('3. Click on "Privacy, search, and services"');
    console.log('4. Under "Clear browsing data", click "Choose what to clear"');
    console.log('5. Select "Cookies and other site data" and "Cached images and files"');
    console.log('6. Click "Clear now"' + colors.reset);
  } else if (browserName.toLowerCase().includes('safari')) {
    console.log(colors.dim + '1. Open Safari and click "Safari" in the menu bar');
    console.log('2. Select "Preferences"');
    console.log('3. Go to the "Privacy" tab');
    console.log('4. Click "Manage Website Data..." and then "Remove All"');
    console.log('5. Go to the "Advanced" tab');
    console.log('6. Check "Show Develop menu in menu bar"');
    console.log('7. Click "Develop" in the menu bar and select "Empty Caches"' + colors.reset);
  } else {
    console.log(colors.dim + '1. Open your browser settings');
    console.log('2. Find the privacy or history section');
    console.log('3. Look for options to clear browsing data, cookies, and cache');
    console.log('4. Select these options and clear the data' + colors.reset);
  }
  
  console.log('\n' + colors.yellow + 'After clearing your browser data:' + colors.reset);
  console.log('1. Restart your browser');
  console.log('2. Visit https://github.com and sign in again');
  console.log('3. Try editing a file in your repository\n');
}

// Generate GitHub token refresh instructions
function generateTokenRefreshInstructions() {
  console.log('\n' + colors.yellow + colors.bold + 'GitHub Token Refresh Instructions:' + colors.reset);
  console.log(colors.dim + '1. Go to https://github.com/settings/tokens');
  console.log('2. Click "Generate new token"');
  console.log('3. Give it a name like "BLACKSKY Bot Token"');
  console.log('4. Set an expiration date (recommended: 90 days)');
  console.log('5. Select these scopes:');
  console.log('   - repo (all)');
  console.log('   - workflow');
  console.log('   - read:packages');
  console.log('6. Click "Generate token"');
  console.log('7. Copy the new token immediately (you won\'t see it again)');
  console.log('8. Update your .env file with the new token' + colors.reset + '\n');
}

// Generate cookie/storage issue fix instructions
function generateCookieFixInstructions() {
  console.log('\n' + colors.yellow + colors.bold + 'GitHub Cookie and Local Storage Issues:' + colors.reset);
  console.log(colors.dim + '1. Check if you have privacy extensions that block cookies or local storage');
  console.log('2. Add an exception for github.com in your privacy extensions');
  console.log('3. Ensure cookies are enabled for github.com');
  console.log('4. Check if your browser is set to clear cookies on exit');
  console.log('5. Disable "Private Browsing" or "Incognito" mode if enabled' + colors.reset + '\n');
}

// Browser issue diagnostic test
async function runBrowserDiagnostics() {
  console.clear();
  console.log(colors.cyan + colors.bold);
  console.log('='.repeat(50));
  console.log('         GITHUB BROWSER ISSUE DIAGNOSTIC         ');
  console.log('='.repeat(50) + colors.reset + '\n');
  
  log('This tool will help diagnose issues with editing files on GitHub through your browser.', 'info');
  
  const browserName = await prompt(colors.green + 'What browser are you using? (Chrome/Firefox/Edge/Safari): ' + colors.reset);
  const browserVersion = await prompt(colors.green + 'What version of the browser? (if known): ' + colors.reset);
  
  log(`Running diagnostics for ${browserName} ${browserVersion}...`, 'info');
  
  // Check GitHub status
  const githubStatus = await checkGitHubStatus();
  
  // Check network connectivity
  const networkConnectivity = checkNetworkConnectivity();
  
  // Check DNS resolution
  const dnsResolution = checkDNS();
  
  // Check network latency
  const networkLatency = checkNetworkLatency();
  
  // Check system resources
  const { memoryOk, cpuOk } = checkSystemResources();
  
  // Check GitHub token
  const tokenValid = await verifyGitHubToken();
  
  // Ask about specific browser issues
  console.log('\n' + colors.yellow + colors.bold + 'Please answer the following questions about your browser:' + colors.reset);
  
  const cookiesEnabled = await prompt(colors.green + 'Are cookies enabled in your browser? (yes/no/not sure): ' + colors.reset);
  const privateMode = await prompt(colors.green + 'Are you using private/incognito browsing mode? (yes/no): ' + colors.reset);
  const extensionsInstalled = await prompt(colors.green + 'Do you have privacy or ad-blocking extensions installed? (yes/no): ' + colors.reset);
  const recentlyCleared = await prompt(colors.green + 'Have you recently cleared your browser cache/cookies? (yes/no): ' + colors.reset);
  const multipleAccounts = await prompt(colors.green + 'Are you signed into multiple GitHub accounts in this browser? (yes/no): ' + colors.reset);
  const specificError = await prompt(colors.green + 'Do you see any specific error message when trying to edit files? (please describe or type "none"): ' + colors.reset);
  
  // Generate results
  console.clear();
  console.log(colors.cyan + colors.bold);
  console.log('='.repeat(50));
  console.log('         GITHUB BROWSER DIAGNOSTIC RESULTS         ');
  console.log('='.repeat(50) + colors.reset + '\n');
  
  log(`Browser: ${browserName} ${browserVersion}`, 'info');
  
  let issuesFound = 0;
  
  // Report on each diagnostic
  if (!githubStatus) {
    log('GitHub status check: ISSUE DETECTED', 'error');
    log('GitHub may be experiencing service issues. Check https://www.githubstatus.com/', 'info');
    issuesFound++;
  }
  
  if (!networkConnectivity) {
    log('Network connectivity: ISSUE DETECTED', 'error');
    log('Unable to connect to GitHub. Check your internet connection.', 'info');
    issuesFound++;
  }
  
  if (!dnsResolution) {
    log('DNS resolution: ISSUE DETECTED', 'error');
    log('Unable to resolve GitHub domain. Check your DNS settings or contact your ISP.', 'info');
    issuesFound++;
  }
  
  if (!networkLatency) {
    log('Network latency: ISSUE DETECTED', 'error');
    log('High network latency to GitHub. This could cause timeouts or slow loading.', 'info');
    issuesFound++;
  }
  
  if (!memoryOk) {
    log('System memory: ISSUE DETECTED', 'error');
    log('Your system is low on memory. Try closing other applications.', 'info');
    issuesFound++;
  }
  
  if (!cpuOk) {
    log('System CPU: ISSUE DETECTED', 'error');
    log('Your CPU usage is high. Try closing other applications.', 'info');
    issuesFound++;
  }
  
  if (!tokenValid) {
    log('GitHub token: ISSUE DETECTED', 'error');
    log('Your GitHub token is invalid or has insufficient permissions.', 'info');
    generateTokenRefreshInstructions();
    issuesFound++;
  }
  
  if (cookiesEnabled.toLowerCase() === 'no' || cookiesEnabled.toLowerCase() === 'not sure') {
    log('Browser cookies: POTENTIAL ISSUE', 'warning');
    log('GitHub requires cookies to be enabled for full functionality.', 'info');
    issuesFound++;
  }
  
  if (privateMode.toLowerCase() === 'yes') {
    log('Private browsing: POTENTIAL ISSUE', 'warning');
    log('Private/incognito mode may cause issues with GitHub authentication.', 'info');
    issuesFound++;
  }
  
  if (extensionsInstalled.toLowerCase() === 'yes') {
    log('Browser extensions: POTENTIAL ISSUE', 'warning');
    log('Privacy or ad-blocking extensions may interfere with GitHub functionality.', 'info');
    issuesFound++;
  }
  
  if (recentlyCleared.toLowerCase() === 'no') {
    log('Browser cache: POTENTIAL ISSUE', 'warning');
    log('Clearing your browser cache might help resolve editing issues.', 'info');
    issuesFound++;
  }
  
  if (multipleAccounts.toLowerCase() === 'yes') {
    log('Multiple GitHub accounts: POTENTIAL ISSUE', 'warning');
    log('Being signed into multiple GitHub accounts can cause permission conflicts.', 'info');
    issuesFound++;
  }
  
  if (specificError !== 'none') {
    log(`Specific error reported: "${specificError}"`, 'info');
  }
  
  // Provide recommendations
  console.log('\n' + colors.green + colors.bold + 'RECOMMENDATIONS:' + colors.reset);
  
  if (issuesFound === 0) {
    console.log('No major issues detected. If you\'re still having problems editing files on GitHub, try the following:');
  } else {
    console.log(`${issuesFound} potential issues detected. Please try the following solutions:`);
  }
  
  // Always provide browser reset instructions
  generateBrowserResetInstructions(browserName);
  
  // Cookie/storage issues
  if (cookiesEnabled.toLowerCase() === 'no' || cookiesEnabled.toLowerCase() === 'not sure' || privateMode.toLowerCase() === 'yes' || extensionsInstalled.toLowerCase() === 'yes') {
    generateCookieFixInstructions();
  }
  
  // GitHub token refresh
  if (!tokenValid) {
    generateTokenRefreshInstructions();
  }
  
  // Multiple accounts
  if (multipleAccounts.toLowerCase() === 'yes') {
    console.log('\n' + colors.yellow + colors.bold + 'Multiple GitHub Accounts Fix:' + colors.reset);
    console.log(colors.dim + '1. Sign out of all GitHub accounts');
    console.log('2. Clear your browser cookies and cache');
    console.log('3. Sign in to only one GitHub account (madariss5)');
    console.log('4. Try editing files again' + colors.reset + '\n');
  }
  
  // Final advice
  console.log('\n' + colors.yellow + colors.bold + 'Alternative Editing Methods:' + colors.reset);
  console.log('1. Use the GitHub Desktop application (https://desktop.github.com/)');
  console.log('2. Use the github-file-editor.js script in this repository');
  console.log('3. Try a different browser\n');
  
  await prompt(colors.green + 'Press Enter to continue...' + colors.reset);
}

// Main function
async function main() {
  await runBrowserDiagnostics();
  
  rl.close();
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log(colors.reset + '\nExiting GitHub Browser Debug Tool. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});