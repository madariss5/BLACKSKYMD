/**
 * Authentication Transfer Utility
 * This script transfers authentication data from the pairing-code-generated auth folder
 * to the main WhatsApp bot auth folder when a successful connection is established
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Auth directories
const SOURCE_DIRS = [
  'auth_info_pairing',
  'auth_info_safari',
  'auth_info_terminal',
  'auth_info_web'
];
const TARGET_DIR = 'auth_info_baileys';

// Lock file to prevent multiple transfers at the same time
const LOCK_FILE = '.auth_transfer.lock';

/**
 * Check if we have valid pairing auth data
 * @returns {Promise<string|null>} The source directory with valid auth, or null if none found
 */
async function checkSourceAuth() {
  for (const dir of SOURCE_DIRS) {
    try {
      if (!fs.existsSync(dir)) continue;
      
      const credPath = path.join(dir, 'creds.json');
      
      if (!fs.existsSync(credPath)) continue;
      
      // Try to read and parse the creds file to ensure it's valid
      const data = fs.readFileSync(credPath, 'utf8');
      const creds = JSON.parse(data);
      
      if (creds && creds.me && creds.me.id) {
        console.log(`[Auth Transfer] Found valid credentials in ${dir}`);
        return dir;
      }
    } catch (error) {
      console.error(`[Auth Transfer] Error checking ${dir}:`, error.message);
    }
  }
  
  return null;
}

/**
 * Check if the target auth directory has valid credentials
 * @returns {Promise<boolean>} Whether target has valid credentials
 */
async function checkTargetAuth() {
  try {
    if (!fs.existsSync(TARGET_DIR)) {
      console.log(`[Auth Transfer] Target directory ${TARGET_DIR} does not exist`);
      return false;
    }
    
    const credPath = path.join(TARGET_DIR, 'creds.json');
    
    if (!fs.existsSync(credPath)) {
      console.log(`[Auth Transfer] Target credentials file not found`);
      return false;
    }
    
    // Try to read and parse the creds file to ensure it's valid
    const data = fs.readFileSync(credPath, 'utf8');
    const creds = JSON.parse(data);
    
    if (creds && creds.me && creds.me.id) {
      console.log(`[Auth Transfer] Target has valid credentials`);
      return true;
    }
    
    console.log(`[Auth Transfer] Target has invalid credentials`);
    return false;
  } catch (error) {
    console.error(`[Auth Transfer] Error checking target auth:`, error.message);
    return false;
  }
}

/**
 * Check if there's a lock file indicating a transfer in progress
 * @returns {boolean} Whether there's a lock file
 */
function checkLockFile() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockTime = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
      const now = Date.now();
      
      // If the lock is older than 1 minute, it's probably stale
      if (now - lockTime > 60000) {
        console.log(`[Auth Transfer] Found stale lock file, removing`);
        fs.unlinkSync(LOCK_FILE);
        return false;
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[Auth Transfer] Error checking lock file:`, error.message);
    return false;
  }
}

/**
 * Create a lock file to prevent concurrent transfers
 */
function createLockFile() {
  try {
    fs.writeFileSync(LOCK_FILE, Date.now().toString());
  } catch (error) {
    console.error(`[Auth Transfer] Error creating lock file:`, error.message);
  }
}

/**
 * Remove the lock file
 */
function removeLockFile() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (error) {
    console.error(`[Auth Transfer] Error removing lock file:`, error.message);
  }
}

/**
 * Transfer authentication data from source to target
 * @param {string} sourceDir The source directory
 * @returns {Promise<boolean>} Whether the transfer was successful
 */
async function transferAuth(sourceDir) {
  console.log(`[Auth Transfer] Transferring auth from ${sourceDir} to ${TARGET_DIR}`);
  
  try {
    // Create lock file
    createLockFile();
    
    // Create target directory if it doesn't exist
    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true });
      console.log(`[Auth Transfer] Created target directory ${TARGET_DIR}`);
    }
    
    // Copy all files from source to target
    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(TARGET_DIR, file);
      
      const sourceData = fs.readFileSync(sourcePath);
      fs.writeFileSync(targetPath, sourceData);
      console.log(`[Auth Transfer] Copied ${file}`);
    }
    
    console.log(`[Auth Transfer] Auth data transferred successfully`);
    
    // Notify the user
    console.log(`[Auth Transfer] Saved credentials to ${TARGET_DIR}`);
    
    // Remove lock file
    removeLockFile();
    
    return true;
  } catch (error) {
    console.error(`[Auth Transfer] Error transferring auth:`, error.message);
    
    // Remove lock file
    removeLockFile();
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`[Auth Transfer] Starting auth transfer process...`);
  
  // Check if there's already a transfer in progress
  if (checkLockFile()) {
    console.log(`[Auth Transfer] Another transfer is in progress, exiting`);
    return;
  }
  
  // Check if we already have valid credentials in the target dir
  const targetHasAuth = await checkTargetAuth();
  if (targetHasAuth) {
    console.log(`[Auth Transfer] Target already has valid credentials, no need to transfer`);
    return;
  }
  
  // Check if we have valid credentials in any source dir
  const sourceDir = await checkSourceAuth();
  if (!sourceDir) {
    console.log(`[Auth Transfer] No valid credentials found in any source directory`);
    return;
  }
  
  // Transfer auth data
  const success = await transferAuth(sourceDir);
  
  if (success) {
    // Run the bot restart command
    console.log(`[Auth Transfer] Attempting to restart the bot...`);
    exec('node connected-bot.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`[Auth Transfer] Error restarting bot:`, error.message);
        return;
      }
      
      console.log(`[Auth Transfer] Bot restart initiated`);
    });
  }
}

// Run main function if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`[Auth Transfer] Unhandled error:`, error);
  });
}