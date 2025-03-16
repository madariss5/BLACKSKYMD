/**
 * GitHub Repository Update Script
 * Uses environment variable for authentication (GITHUB_TOKEN)
 * Automatically pushes changes to GitHub
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DEFAULT_COMMIT_MESSAGE = "Update WhatsApp Bot with improved configuration";
const DEFAULT_BRANCH = "main";
const DEFAULT_REMOTE = "origin";
// Use a predefined repository URL instead of asking for input
const REPO_URL = "https://github.com/madariss5/BLACKSKY.git";

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

// Ensure logs directory exists
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// Create log file
const logFile = path.join('./logs', `github-update-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Helper function to log messages to console and file
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
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
  logStream.write(`[${timestamp}] ${message}\n`);
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
      
      if (stderr) {
        log(`Command output (stderr): ${stderr}`, 'warning');
      }
      
      if (stdout) {
        log(`Command output: ${stdout}`, 'info');
      }
      
      resolve({ stdout, stderr });
    });
  });
}

// Check if git is installed
async function checkGitInstalled() {
  try {
    await executeCommand('git --version');
    return true;
  } catch (error) {
    log('Git is not installed. Please install git first.', 'error');
    return false;
  }
}

// Initialize git repository if needed
async function initializeGitRepo() {
  if (!fs.existsSync('.git')) {
    log('Initializing git repository...', 'info');
    try {
      await executeCommand('git init');
      log('Git repository initialized successfully', 'success');
    } catch (error) {
      log('Failed to initialize git repository', 'error');
      throw error;
    }
  } else {
    log('Git repository already initialized', 'info');
  }
}

// Create or update .gitignore file
async function setupGitignore() {
  const gitignorePath = '.gitignore';
  const standardEntries = [
    'node_modules/',
    'auth_info*/',
    '.env',
    '*.log',
    'npm-debug.log*',
    'tmp/',
    'temp/',
    '*.tmp',
    '.DS_Store',
    'Thumbs.db',
    '.idea/',
    '.vscode/',
    '*.swp',
    '*.swo',
    '*.auth.json'
  ];
  
  let content = '';
  
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
    log('Existing .gitignore file found, updating if needed', 'info');
  } else {
    log('Creating .gitignore file', 'info');
  }
  
  let needsUpdate = false;
  for (const entry of standardEntries) {
    if (!content.includes(entry)) {
      content += entry + '\n';
      needsUpdate = true;
    }
  }
  
  if (needsUpdate) {
    fs.writeFileSync(gitignorePath, content, 'utf8');
    log('.gitignore file updated', 'success');
  } else {
    log('.gitignore file is already up to date', 'info');
  }
}

// Configure Git credentials using the token
async function configureGitCredentials() {
  if (!GITHUB_TOKEN) {
    log('GitHub token not found. Please set the GITHUB_TOKEN environment variable.', 'error');
    throw new Error('GitHub token not available');
  }

  try {
    // Use the token in the remote URL for authentication
    log('Configuring Git credentials with token authentication', 'info');
    
    // Parse the URL to insert the token
    const urlMatch = REPO_URL.match(/https:\/\/github\.com\/([^\/]+)\/([^\.]+)(\.git)?/);
    if (!urlMatch) {
      log('Invalid GitHub repository URL format.', 'error');
      throw new Error('Invalid repository URL format');
    }
    
    const [_, username, repo] = urlMatch;
    const tokenUrl = `https://${GITHUB_TOKEN}@github.com/${username}/${repo}.git`;
    
    // Check if remote already exists
    const { stdout } = await executeCommand('git remote -v');
    
    if (stdout.includes(DEFAULT_REMOTE)) {
      log(`Remote '${DEFAULT_REMOTE}' already exists, updating...`, 'info');
      await executeCommand(`git remote set-url ${DEFAULT_REMOTE} ${tokenUrl}`);
    } else {
      log(`Adding remote '${DEFAULT_REMOTE}'...`, 'info');
      await executeCommand(`git remote add ${DEFAULT_REMOTE} ${tokenUrl}`);
    }
    
    log('Git remote configured successfully with token authentication', 'success');
  } catch (error) {
    log('Failed to configure Git credentials', 'error');
    throw error;
  }
}

// Add files to git
async function addFilesToGit() {
  log('Adding files to git...', 'info');
  
  // Main code files
  await executeCommand('git add src/ data/ public/ views/');
  
  // Configuration files
  await executeCommand('git add package.json package-lock.json *.js .replit .env.example');
  
  // Documentation
  await executeCommand('git add *.md LICENSE Procfile app.json');
  
  // Docker and deployment files
  await executeCommand('git add Dockerfile heroku.yml .slugignore');
  
  log('Files added successfully', 'success');
}

// Commit changes
async function commitChanges(message = DEFAULT_COMMIT_MESSAGE) {
  try {
    log(`Committing changes with message: "${message}"`, 'info');
    await executeCommand(`git commit -m "${message}"`);
    log('Changes committed successfully', 'success');
  } catch (error) {
    if (error.message.includes('nothing to commit')) {
      log('No changes to commit', 'warning');
    } else {
      log('Failed to commit changes', 'error');
      throw error;
    }
  }
}

// Push changes to GitHub
async function pushChanges() {
  try {
    log(`Pushing changes to ${DEFAULT_REMOTE}/${DEFAULT_BRANCH}...`, 'info');
    await executeCommand(`git push -u ${DEFAULT_REMOTE} ${DEFAULT_BRANCH}`);
    log('Changes pushed successfully', 'success');
    return true;
  } catch (error) {
    log('Failed to push changes', 'error');
    
    if (error.message.includes('rejected')) {
      log('Remote contains work that you do not have locally. Trying to pull first.', 'warning');
      
      try {
        log('Pulling latest changes...', 'info');
        await executeCommand(`git pull ${DEFAULT_REMOTE} ${DEFAULT_BRANCH}`);
        log('Pull successful, now pushing changes...', 'info');
        await executeCommand(`git push ${DEFAULT_REMOTE} ${DEFAULT_BRANCH}`);
        log('Changes pushed successfully after pull', 'success');
        return true;
      } catch (pullError) {
        log('Failed to pull or push changes', 'error');
        return false;
      }
    } else {
      return false;
    }
  }
}

// Main function
async function main() {
  log('================================================', 'header');
  log('       BLACKSKY-MD GitHub Update Script        ', 'header');
  log('================================================', 'header');
  
  try {
    // Check if git is installed
    const gitInstalled = await checkGitInstalled();
    if (!gitInstalled) {
      process.exit(1);
    }
    
    // Initialize git repository if needed
    await initializeGitRepo();
    
    // Setup .gitignore
    await setupGitignore();
    
    // Configure git credentials
    await configureGitCredentials();
    
    // Add files to git
    await addFilesToGit();
    
    // Show git status
    await executeCommand('git status');
    
    // Commit changes
    await commitChanges();
    
    // Push changes to GitHub
    const pushed = await pushChanges();
    
    log('================================================', 'header');
    if (pushed) {
      log('GitHub update completed successfully!', 'success');
    } else {
      log('GitHub update completed with warnings. Some actions may not have completed.', 'warning');
    }
    log('================================================', 'header');
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the main function
main();