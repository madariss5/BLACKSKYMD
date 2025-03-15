/**
 * WhatsApp Session Importer
 * 
 * This script helps import authentication sessions created on a local machine
 * into your Replit environment to avoid the 405 error restriction.
 * 
 * Usage:
 * 1. First establish a connection on your local machine using local-connect.js
 * 2. Upload the auth_info_baileys folder to your Replit project
 * 3. Run this script to validate and import the session
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createInterface } = require('readline');

// Configuration
const SOURCE_AUTH_PATHS = [
  './auth_info_baileys',        // Default from local-connect.js
  './auth_info_baileys_qr',     // Alternative QR-based auth
  './auth_info',                // Generic auth folder
  './auth_info_direct'          // Direct connection auth
];

const TARGET_AUTH_FOLDERS = [
  './auth_info_safari',         // Safari-based connection
  './auth_info_persistent',     // Persistent connection 
  './auth_info_enhanced',       // Enhanced pairing connection
  './auth_info_flash'           // FLASH-MD connection
];

// Utility functions
const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    readline.question(question, resolve);
  });
}

function success(message) {
  console.log(`✅ ${message}`);
}

function info(message) {
  console.log(`ℹ️ ${message}`);
}

function warning(message) {
  console.log(`⚠️ ${message}`);
}

function error(message) {
  console.log(`❌ ${message}`);
}

function calculateChecksum(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (err) {
    return null;
  }
}

async function findSourceAuth() {
  info('Searching for authentication data...');
  
  for (const authPath of SOURCE_AUTH_PATHS) {
    if (!fs.existsSync(authPath)) {
      continue;
    }
    
    const credPath = path.join(authPath, 'creds.json');
    if (!fs.existsSync(credPath)) {
      continue;
    }
    
    try {
      const credsData = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (credsData && credsData.me && credsData.me.id) {
        success(`Found valid credentials in ${authPath}`);
        return authPath;
      }
    } catch (err) {
      error(`Error reading credentials from ${authPath}: ${err.message}`);
    }
  }
  
  return null;
}

async function importSession() {
  const sourceAuthPath = await findSourceAuth();
  
  if (!sourceAuthPath) {
    error('No valid authentication data found!');
    info('Please upload the auth_info_baileys folder from your local machine');
    info('See CLOUD_ENVIRONMENT_GUIDE.md for detailed instructions');
    return false;
  }
  
  const validTargets = [];
  
  info('Checking target folders...');
  for (const targetPath of TARGET_AUTH_FOLDERS) {
    // Create folder if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      try {
        fs.mkdirSync(targetPath, { recursive: true });
        success(`Created target folder: ${targetPath}`);
      } catch (err) {
        error(`Could not create folder ${targetPath}: ${err.message}`);
        continue;
      }
    }
    validTargets.push(targetPath);
  }
  
  if (validTargets.length === 0) {
    error('No valid target folders available!');
    return false;
  }
  
  // Display menu for target selection
  console.log('\nSelect where to import the credentials:');
  validTargets.forEach((target, index) => {
    console.log(`${index + 1}. ${target} (${getConnectionMethodName(target)})`);
  });
  console.log(`${validTargets.length + 1}. Import to all targets (Recommended)`);
  
  const choice = await ask('\nEnter your choice [1-' + (validTargets.length + 1) + ']: ');
  const choiceNum = parseInt(choice);
  
  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > validTargets.length + 1) {
    error('Invalid choice. Using default option (import to all).');
    await importToAll(sourceAuthPath, validTargets);
    return true;
  }
  
  if (choiceNum === validTargets.length + 1) {
    await importToAll(sourceAuthPath, validTargets);
    return true;
  } else {
    const targetPath = validTargets[choiceNum - 1];
    await importToTarget(sourceAuthPath, targetPath);
    return true;
  }
}

function getConnectionMethodName(authPath) {
  if (authPath.includes('safari')) return 'Safari Connect';
  if (authPath.includes('persistent')) return 'Persistent Connection';
  if (authPath.includes('enhanced')) return 'Enhanced Pairing';
  if (authPath.includes('flash')) return 'FLASH-MD';
  return 'Standard Connection';
}

async function importToTarget(sourcePath, targetPath) {
  info(`Importing from ${sourcePath} to ${targetPath}...`);
  
  try {
    const sourceFiles = fs.readdirSync(sourcePath);
    
    // Clear existing files in target
    if (fs.existsSync(targetPath)) {
      const targetFiles = fs.readdirSync(targetPath);
      for (const file of targetFiles) {
        fs.unlinkSync(path.join(targetPath, file));
      }
    }
    
    // Copy all files
    let copiedCount = 0;
    for (const file of sourceFiles) {
      const sourceFile = path.join(sourcePath, file);
      const targetFile = path.join(targetPath, file);
      
      if (fs.lstatSync(sourceFile).isFile()) {
        fs.copyFileSync(sourceFile, targetFile);
        copiedCount++;
      }
    }
    
    success(`Imported ${copiedCount} files to ${targetPath}`);
    
    // Verify creds.json in target
    const targetCredPath = path.join(targetPath, 'creds.json');
    if (fs.existsSync(targetCredPath)) {
      try {
        const credsData = JSON.parse(fs.readFileSync(targetCredPath, 'utf8'));
        if (credsData && credsData.me && credsData.me.id) {
          success(`Verified credentials for: ${credsData.me.name || credsData.me.id}`);
          
          // Compare checksums
          const sourceHash = calculateChecksum(path.join(sourcePath, 'creds.json'));
          const targetHash = calculateChecksum(targetCredPath);
          
          if (sourceHash && targetHash && sourceHash === targetHash) {
            success('Credential integrity verified ✓');
          } else {
            warning('Credential checksums do not match - there may be an issue with the copy');
          }
        }
      } catch (err) {
        error(`Error verifying credentials in ${targetPath}: ${err.message}`);
      }
    } else {
      error(`Failed to copy creds.json to ${targetPath}`);
    }
    
    return true;
  } catch (err) {
    error(`Import to ${targetPath} failed: ${err.message}`);
    return false;
  }
}

async function importToAll(sourcePath, targets) {
  info('Importing to all target folders...');
  
  let successCount = 0;
  for (const targetPath of targets) {
    if (await importToTarget(sourcePath, targetPath)) {
      successCount++;
    }
  }
  
  if (successCount === targets.length) {
    success(`Successfully imported to all ${targets.length} targets`);
    return true;
  } else {
    warning(`Imported to ${successCount}/${targets.length} targets`);
    return successCount > 0;
  }
}

// Main function
async function main() {
  console.log('\n===============================================');
  console.log('📱 WHATSAPP SESSION IMPORTER v1.0.0');
  console.log('===============================================');
  console.log('This tool helps import authentication sessions');
  console.log('created locally to avoid the 405 error in Replit');
  console.log('===============================================\n');
  
  const result = await importSession();
  
  if (result) {
    success('\nSession import completed successfully!');
    info('You can now run any of the following workflows:');
    info('1. "Safari Connect" (Recommended)');
    info('2. "Persistent Connection"');
    info('3. "WhatsApp Bot"');
    info('\nNo need to scan a QR code or enter a pairing code again');
  } else {
    error('\nSession import failed!');
    info('Please make sure you have uploaded the auth_info_baileys folder');
    info('from your local machine to your Replit project');
  }
  
  readline.close();
}

// Run main function
main().catch(err => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});