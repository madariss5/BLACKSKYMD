/**
 * Import Authentication to Heroku Format
 * 
 * This script copies authentication data from an existing working session
 * (like enhanced or flash) to the auth_info_heroku folder for Heroku deployment.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_FOLDERS = [
  'auth_info_enhanced',
  'auth_info_flash',
  'auth_info_direct'
];
const TARGET_FOLDER = 'auth_info_heroku';

// Ensure the target directory exists
if (!fs.existsSync(TARGET_FOLDER)) {
  fs.mkdirSync(TARGET_FOLDER, { recursive: true });
  console.log(`Created target folder: ${TARGET_FOLDER}`);
}

// Function to copy credentials
function copyCredentials(sourceFolder) {
  const sourceCredsPath = path.join(sourceFolder, 'creds.json');
  
  // Check if source creds.json exists
  if (!fs.existsSync(sourceCredsPath)) {
    console.log(`❌ No creds.json found in ${sourceFolder}`);
    return false;
  }
  
  try {
    // Copy creds.json to target folder
    const targetCredsPath = path.join(TARGET_FOLDER, 'creds.json');
    fs.copyFileSync(sourceCredsPath, targetCredsPath);
    
    // Check if any additional files need to be copied
    const sourceFiles = fs.readdirSync(sourceFolder);
    for (const file of sourceFiles) {
      if (file !== 'creds.json') {
        const sourcePath = path.join(sourceFolder, file);
        const targetPath = path.join(TARGET_FOLDER, file);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copied additional file: ${file}`);
      }
    }
    
    console.log(`✅ Successfully copied credentials from ${sourceFolder} to ${TARGET_FOLDER}`);
    return true;
  } catch (err) {
    console.error(`❌ Error copying credentials from ${sourceFolder}:`, err);
    return false;
  }
}

// Main function
function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║      HEROKU AUTHENTICATION IMPORTER         ║');
  console.log('╚════════════════════════════════════════════╝');
  
  let success = false;
  
  // Try each source folder
  for (const folder of SOURCE_FOLDERS) {
    console.log(`\nChecking ${folder}...`);
    if (fs.existsSync(folder)) {
      if (copyCredentials(folder)) {
        success = true;
        break;
      }
    } else {
      console.log(`Folder ${folder} does not exist, skipping.`);
    }
  }
  
  if (success) {
    console.log('\n✅ Authentication data successfully imported for Heroku deployment.');
    console.log('\nNext steps:');
    console.log('1. Deploy your bot code to Heroku');
    console.log('2. Copy the auth_info_heroku folder to your Heroku server');
    console.log('3. Run node heroku-bot.js on your Heroku server');
  } else {
    console.log('\n❌ Failed to import authentication data.');
    console.log('\nTo resolve this:');
    console.log('1. Run node local-connect.js on your local machine');
    console.log('2. Scan the QR code with your WhatsApp');
    console.log('3. Copy the generated auth_info_baileys folder to this project');
    console.log('4. Then run this script again');
  }
}

// Run the script
main();