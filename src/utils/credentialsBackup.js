/**
 * WhatsApp Credentials Backup Utility
 * Provides robust credentials management with backup and recovery capabilities
 * Especially useful for cloud environments like Replit/Heroku
 */

const fs = require('fs');
const { safeSendMessage, safeSendText, safeSendImage } = require('./jidHelper');
const path = require('path');
const crypto = require('crypto');

// Constants
const BACKUP_DIR = path.join(process.cwd(), 'sessions');
const AUTH_DIR = path.join(process.cwd(), 'auth_info');
const MAX_BACKUPS = 5;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Calculate SHA-256 checksum of data
 * @param {string} data The data to hash
 * @returns {string} The checksum
 */
function calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Backup credentials to file
 * @param {Object} creds The credentials object from Baileys
 * @returns {string|null} Path to backup file or null if failed
 */
async function backupCredentials(creds) {
    try {
        // Convert creds to string with added checksum
        const credsString = JSON.stringify(creds);
        const checksum = calculateChecksum(credsString);
        const backupData = JSON.stringify({
            creds,
            meta: {
                timestamp: Date.now(),
                checksum,
                version: '1.0'
            }
        });

        // Create backup filename with timestamp
        const timestamp = Date.now();
        const backupPath = path.join(BACKUP_DIR, `creds_backup_${timestamp}.json`);
        
        // Write backup file
        fs.writeFileSync(backupPath, backupData);
        console.log(`[CredBackup] Credentials backed up successfully to ${backupPath}`);
        
        // Maintain only the latest MAX_BACKUPS files
        cleanupOldBackups();
        
        return backupPath;
    } catch (error) {
        console.error('[CredBackup] Error backing up credentials:', error);
        return null;
    }
}

/**
 * Remove old backup files, keeping only the most recent ones
 */
function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('creds_backup_') && file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Sort by time, newest first
        
        // Delete older files beyond the limit
        if (files.length > MAX_BACKUPS) {
            const filesToDelete = files.slice(MAX_BACKUPS);
            for (const file of filesToDelete) {
                fs.unlinkSync(file.path);
                console.log(`[CredBackup] Deleted old backup: ${file.name}`);
            }
        }
    } catch (error) {
        console.error('[CredBackup] Error cleaning up old backups:', error);
    }
}

/**
 * Restore credentials from the most recent valid backup
 * @returns {Object|null} The restored credentials or null if failed
 */
async function restoreCredentials() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('creds_backup_') && file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Sort by time, newest first
        
        if (files.length === 0) {
            console.log('[CredBackup] No backup files found');
            return null;
        }
        
        // Try to restore from backups, starting with the newest
        for (const file of files) {
            try {
                console.log(`[CredBackup] Attempting to restore from ${file.name}`);
                const data = fs.readFileSync(file.path, 'utf8');
                const parsed = JSON.parse(data);
                
                // Verify checksum
                if (parsed.meta && parsed.meta.checksum) {
                    const credsString = JSON.stringify(parsed.creds);
                    const checksum = calculateChecksum(credsString);
                    
                    if (checksum !== parsed.meta.checksum) {
                        console.warn(`[CredBackup] Checksum mismatch in ${file.name}, trying next backup`);
                        continue;
                    }
                }
                
                console.log(`[CredBackup] Successfully restored credentials from ${file.name}`);
                return parsed.creds;
            } catch (err) {
                console.warn(`[CredBackup] Failed to restore from ${file.name}, trying next backup`);
            }
        }
        
        console.error('[CredBackup] All backup files are invalid');
        return null;
    } catch (error) {
        console.error('[CredBackup] Error restoring credentials:', error);
        return null;
    }
}

/**
 * Restore credentials and recreate auth files
 * @returns {boolean} Whether restoration was successful
 */
async function restoreAuthFiles() {
    try {
        const creds = await restoreCredentials();
        if (!creds) {
            return false;
        }
        
        // Ensure auth directory exists
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        
        // Write creds.json file
        fs.writeFileSync(path.join(AUTH_DIR, 'creds.json'), JSON.stringify(creds, null, 2));
        console.log('[CredBackup] Auth files restored successfully');
        
        return true;
    } catch (error) {
        console.error('[CredBackup] Error restoring auth files:', error);
        return false;
    }
}

/**
 * Send creds to a WhatsApp number for emergency backup
 * @param {Object} sock WhatsApp socket object
 * @param {string} number Target number in format 1234567890@s.whatsapp.net
 * @returns {Promise<boolean>} Whether the backup was sent successfully
 */
async function sendCredsBackup(sock, number) {
    try {
        // Find latest backup file
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('creds_backup_') && file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Sort by time, newest first
        
        if (files.length === 0) {
            console.log('[CredBackup] No backup files found for sending');
            return false;
        }
        
        const latestFile = files[0];
        
        // Send file to target number
        await safeSendMessage(sock, number, {
            document: fs.readFileSync(latestFile.path),
            mimetype: 'application/json',
            fileName: latestFile.name,
            caption: `🔐 *WhatsApp Bot Credentials Backup*\n\n📅 Date: ${new Date().toISOString()}\n⚠️ Keep this file private and secure - it contains your bot session data`
        });
        
        console.log(`[CredBackup] Credentials backup sent to ${number}`);
        return true;
    } catch (error) {
        console.error('[CredBackup] Error sending credentials backup:', error);
        return false;
    }
}

module.exports = {
    backupCredentials,
    restoreCredentials,
    restoreAuthFiles,
    sendCredsBackup,
    BACKUP_DIR
};