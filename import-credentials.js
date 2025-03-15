/**
 * WhatsApp Credentials Importer
 * This script helps you import WhatsApp credentials from a local connection
 * to your Replit-hosted bot.
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Configuration
const SOURCE_ZIP = './whatsapp-credentials.zip';
const TARGET_DIR = './auth_info_baileys';
const BACKUP_DIR = './auth_info_backup';

// Create backup of current credentials if they exist
function backupCurrentCredentials() {
  if (fs.existsSync(TARGET_DIR)) {
    console.log('📦 Backing up current credentials...');
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Create timestamp for the backup
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupPath = path.join(BACKUP_DIR, `auth_backup_${timestamp}`);
    
    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });
    
    // Copy all files to backup
    const files = fs.readdirSync(TARGET_DIR);
    files.forEach(file => {
      const srcPath = path.join(TARGET_DIR, file);
      const destPath = path.join(backupPath, file);
      fs.copyFileSync(srcPath, destPath);
    });
    
    console.log(`✅ Created backup at: ${backupPath}`);
    return true;
  }
  
  console.log('ℹ️ No existing credentials to backup.');
  return false;
}

// Import credentials from zip file
function importCredentials() {
  if (!fs.existsSync(SOURCE_ZIP)) {
    console.error(`❌ Credentials zip file not found: ${SOURCE_ZIP}`);
    console.log('💡 You need to upload the whatsapp-credentials.zip file to your Replit project first.');
    console.log('💡 Run the local-connection.js script on your local machine to generate this file.');
    return false;
  }
  
  try {
    // Extract zip file
    console.log('📂 Extracting credentials...');
    const zip = new AdmZip(SOURCE_ZIP);
    
    // Ensure target directory exists
    if (!fs.existsSync(TARGET_DIR)) {
      fs.mkdirSync(TARGET_DIR, { recursive: true });
    } else {
      // Clean target directory
      fs.rmSync(TARGET_DIR, { recursive: true, force: true });
      fs.mkdirSync(TARGET_DIR, { recursive: true });
    }
    
    // Extract contents
    zip.extractAllTo(TARGET_DIR, true);
    
    console.log('✅ Credentials imported successfully!');
    console.log(`✅ Auth files have been imported to: ${TARGET_DIR}`);
    console.log('🔄 You can now restart your bot to use the new credentials.');
    
    return true;
  } catch (error) {
    console.error('❌ Error importing credentials:', error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('\n=== WhatsApp Credentials Importer ===\n');
  
  // Backup current credentials
  backupCurrentCredentials();
  
  // Import new credentials
  const result = importCredentials();
  
  if (result) {
    console.log('\n🎉 Import process completed successfully!');
    console.log('📱 Your WhatsApp bot should now be able to connect without scanning a QR code.');
    console.log('🔄 Make sure to restart your bot workflow after importing.');
  } else {
    console.log('\n❌ Import process failed.');
    console.log('💡 Make sure you have uploaded whatsapp-credentials.zip to your Replit project.');
  }
}

// Run the main function
main();