/**
 * Authentication Copy Utility
 * Copies authentication files from Terminal QR session to main auth folder
 */

const fs = require('fs');
const path = require('path');

// Source and destination directories
const SOURCE_DIR = './auth_info_terminal';
const DEST_DIR = './auth_info_baileys';

// Ensure destination directory exists
if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
    console.log(`Created destination directory: ${DEST_DIR}`);
}

// Copy files
try {
    // Check if source directory exists
    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`Source directory ${SOURCE_DIR} does not exist!`);
        process.exit(1);
    }

    // Get all files from source
    const files = fs.readdirSync(SOURCE_DIR);
    
    if (files.length === 0) {
        console.error('No authentication files found in source directory!');
        process.exit(1);
    }
    
    console.log(`Found ${files.length} files to copy`);
    
    // Copy each file
    let copiedCount = 0;
    for (const file of files) {
        const srcPath = path.join(SOURCE_DIR, file);
        const destPath = path.join(DEST_DIR, file);
        
        // Only copy files, not directories
        if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath);
            copiedCount++;
            console.log(`Copied: ${file}`);
        }
    }
    
    console.log(`Successfully copied ${copiedCount} authentication files`);
    console.log('Please restart the WhatsApp Bot workflow now');
    
} catch (error) {
    console.error(`Error copying files: ${error.message}`);
    process.exit(1);
}