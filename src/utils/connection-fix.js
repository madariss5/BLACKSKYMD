/**
 * Connection Error Fix Utility
 * Specialized in handling decryption errors in WhatsApp connections
 */

const fs = require('fs');
const path = require('path');

/**
 * Clear auth files for a specific browser configuration
 * @param {string} authFolder - Path to auth folder to clean
 * @returns {boolean} - Whether cleanup was successful
 */
function clearAuthFiles(authFolder) {
    try {
        console.log(`Cleaning auth files in ${authFolder}...`);
        
        if (!fs.existsSync(authFolder)) {
            console.log(`Auth folder ${authFolder} does not exist.`);
            return false;
        }
        
        const files = fs.readdirSync(authFolder);
        
        // No files to delete
        if (files.length === 0) {
            console.log(`No files found in ${authFolder}.`);
            return true;
        }
        
        // Delete each file in the folder
        let successCount = 0;
        for (const file of files) {
            const filePath = path.join(authFolder, file);
            try {
                fs.unlinkSync(filePath);
                successCount++;
                console.log(`Deleted: ${filePath}`);
            } catch (err) {
                console.error(`Failed to delete ${filePath}: ${err.message}`);
            }
        }
        
        console.log(`Successfully deleted ${successCount}/${files.length} files from ${authFolder}`);
        return successCount > 0;
    } catch (err) {
        console.error(`Error cleaning auth folder ${authFolder}: ${err.message}`);
        return false;
    }
}

/**
 * Clean all standard auth folders
 * @returns {Object} - Results of cleaning operation
 */
function cleanAllAuthFolders() {
    const authFolders = [
        './auth_info',
        './auth_info_baileys',
        './auth_info_baileys_fresh',
        './auth_info_baileys_qr',
        './auth_info_manager_chrome',
        './auth_info_manager_edge',
        './auth_info_manager_firefox',
        './auth_info_manager_opera',
        './auth_info_manager_safari',
        './auth_info_terminal_qr'
    ];
    
    console.log('🧹 Starting complete auth cleanup for decryption error fix...');
    
    const results = {
        totalFolders: authFolders.length,
        cleanedFolders: 0,
        failedFolders: 0,
        details: {}
    };
    
    for (const folder of authFolders) {
        try {
            const success = clearAuthFiles(folder);
            results.details[folder] = success ? 'cleaned' : 'failed';
            
            if (success) {
                results.cleanedFolders++;
            } else {
                results.failedFolders++;
            }
        } catch (err) {
            console.error(`Error processing ${folder}: ${err.message}`);
            results.details[folder] = 'error';
            results.failedFolders++;
        }
    }
    
    console.log(`Auth cleanup complete: Cleaned ${results.cleanedFolders}/${results.totalFolders} folders`);
    return results;
}

/**
 * Fix decryption errors by cleaning all authentication files
 * and creating new clean authentication state
 */
function fixDecryptionErrors() {
    console.log('📢 Starting decryption error fix procedure...');
    
    // 1. Clean all auth folders
    const cleanupResults = cleanAllAuthFolders();
    
    // 2. Create fresh auth directories if needed
    const freshFolders = [
        './auth_info',
        './auth_info_baileys',
        './auth_info_manager_firefox'
    ];
    
    for (const folder of freshFolders) {
        try {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
                console.log(`Created fresh directory: ${folder}`);
            }
        } catch (err) {
            console.error(`Failed to create directory ${folder}: ${err.message}`);
        }
    }
    
    console.log('✅ Decryption error fix complete - please restart the connection manager');
    return cleanupResults;
}

module.exports = {
    clearAuthFiles,
    cleanAllAuthFolders,
    fixDecryptionErrors
};