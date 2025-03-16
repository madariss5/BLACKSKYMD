/**
 * Cleanup script for WhatsApp auth files
 */
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

// Directories to clean
const authDirs = [
    './auth_info_baileys',
    './auth_info_terminal',
    './auth_info_qr',
    './auth_info_safari',
    './backups',
    './auth_info_baileys_backup',
    './data/session_backups'
];

// Files to remove
const filesToRemove = ['creds.json', 'creds.backup.json'];

function cleanupAuth() {
    let totalRemoved = 0;

    authDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            filesToRemove.forEach(file => {
                const filePath = path.join(dir, file);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        logger.info(`Removed: ${filePath}`);
                        totalRemoved++;
                    } catch (err) {
                        logger.error(`Failed to remove ${filePath}: ${err.message}`);
                    }
                }
            });

            // Remove empty backup directories (except main auth directory)
            if (dir !== './auth_info_baileys' && fs.readdirSync(dir).length === 0) {
                try {
                    fs.rmdirSync(dir);
                    logger.info(`Removed empty directory: ${dir}`);
                } catch (err) {
                    logger.error(`Failed to remove directory ${dir}: ${err.message}`);
                }
            }
        }
    });

    logger.info(`Cleanup completed. Removed ${totalRemoved} credential files.`);
}

// Run cleanup
cleanupAuth();
