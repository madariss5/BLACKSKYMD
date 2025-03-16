/**
 * Connection Fix for WhatsApp Bot
 * This file resolves the "conflict" error by cleaning up all auth directories
 */

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf').sync; // This should be part of your dependencies

// List of directories to clean up
const AUTH_DIRECTORIES = [
  'auth_info',
  'auth_info_baileys',
  'auth_info_multi',
  'auth_info_baileys_qr',
  'auth_info_simple_pairing',
  'auth_info_heroku',
  'auth_info_test'
];

/**
 * Delete all authentication directories
 */
function cleanupAuthDirectories() {
  console.log('Cleaning up authentication directories...');
  
  for (const dir of AUTH_DIRECTORIES) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      try {
        rimraf(dirPath);
        console.log(`✅ Removed directory: ${dir}`);
      } catch (err) {
        console.error(`❌ Failed to remove directory ${dir}: ${err.message}`);
      }
    } else {
      console.log(`Directory not found: ${dir}`);
    }
  }
  
  console.log('Authentication cleanup completed. Please restart the bot.');
}

// Run the cleanup
cleanupAuthDirectories();