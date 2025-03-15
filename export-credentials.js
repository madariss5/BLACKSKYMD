/**
 * WhatsApp Credentials Export Utility
 * This script exports your current WhatsApp credentials for backup or transfer
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Configuration
const SOURCE_DIR = './auth_info_baileys';
const OUTPUT_FILE = './whatsapp-credentials-export.zip';

/**
 * Check if credentials exist
 * @returns {boolean} Whether credentials exist
 */
function checkCredentials() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ No credentials found in ${SOURCE_DIR}`);
    return false;
  }
  
  // Check for key files that must exist
  const files = fs.readdirSync(SOURCE_DIR);
  if (!files.some(file => file.includes('creds.json'))) {
    console.error('❌ No valid credentials found (missing creds.json)');
    return false;
  }
  
  return true;
}

/**
 * Export credentials to zip file
 * @returns {boolean} Whether export was successful
 */
function exportCredentials() {
  try {
    console.log('📦 Creating credentials zip file...');
    
    // Create zip archive
    const zip = new AdmZip();
    
    // Add all files from auth directory
    const files = fs.readdirSync(SOURCE_DIR);
    files.forEach(file => {
      const filePath = path.join(SOURCE_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        zip.addLocalFile(filePath);
      }
    });
    
    // Write zip file
    zip.writeZip(OUTPUT_FILE);
    
    console.log(`✅ Credentials exported to: ${OUTPUT_FILE}`);
    
    // Get file size for confirmation
    const stats = fs.statSync(OUTPUT_FILE);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    return true;
  } catch (error) {
    console.error('❌ Error exporting credentials:', error.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log('\n=== WhatsApp Credentials Export Utility ===\n');
  
  // Check for credentials
  if (!checkCredentials()) {
    console.log('\n❌ Export failed: No valid credentials found.');
    console.log('💡 You need to connect to WhatsApp first before exporting credentials.');
    return;
  }
  
  // Export credentials
  const result = exportCredentials();
  
  if (result) {
    console.log('\n🎉 Export process completed successfully!');
    console.log('💾 Keep this file safe as it contains your WhatsApp session data.');
    console.log('💡 You can use import-credentials.js to restore this session later.');
  } else {
    console.log('\n❌ Export process failed.');
  }
}

// Run the main function
main();