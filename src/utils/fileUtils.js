/**
 * File Utilities
 * Provides helper functions for file operations
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Ensure a directory exists, creating it if it doesn't
 * @param {string} dir - Directory path
 * @returns {boolean} - Whether the directory exists after the operation
 */
function ensureDirectoryExists(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info(`Created directory: ${dir}`);
        }
        return true;
    } catch (err) {
        logger.error(`Error creating directory ${dir}:`, err);
        return false;
    }
}

/**
 * Read a JSON file with error handling
 * @param {string} filePath - Path to JSON file
 * @returns {Object|null} - Parsed JSON or null if error
 */
function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        logger.error(`Error reading JSON file ${filePath}:`, err);
        return null;
    }
}

/**
 * Write a JSON file with error handling
 * @param {string} filePath - Path to JSON file
 * @param {Object} data - Data to write
 * @returns {boolean} - Whether the write was successful
 */
function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        ensureDirectoryExists(dir);
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        logger.error(`Error writing JSON file ${filePath}:`, err);
        return false;
    }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} - Whether the file exists
 */
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (err) {
        logger.error(`Error checking if file exists ${filePath}:`, err);
        return false;
    }
}

/**
 * List all files in a directory
 * @param {string} dir - Directory to list
 * @param {Object} options - Options
 * @param {boolean} options.recursive - Whether to list subdirectories too
 * @param {Array} options.extensions - Array of extensions to filter by (e.g. ['.js', '.json'])
 * @returns {Array} - Array of file paths
 */
async function listFiles(dir, options = {}) {
    const { recursive = false, extensions = null } = options;
    
    try {
        if (!fs.existsSync(dir)) {
            return [];
        }
        
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async entry => {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                return recursive ? listFiles(fullPath, options) : [];
            } else {
                if (extensions && !extensions.some(ext => fullPath.endsWith(ext))) {
                    return [];
                }
                return [fullPath];
            }
        }));
        
        return files.flat();
    } catch (err) {
        logger.error(`Error listing files in ${dir}:`, err);
        return [];
    }
}

/**
 * Delete a file with error handling
 * @param {string} filePath - Path to file
 * @returns {boolean} - Whether the delete was successful
 */
function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (err) {
        logger.error(`Error deleting file ${filePath}:`, err);
        return false;
    }
}

/**
 * Copy a file with error handling
 * @param {string} sourcePath - Source file
 * @param {string} destPath - Destination file
 * @returns {boolean} - Whether the copy was successful
 */
function copyFile(sourcePath, destPath) {
    try {
        if (!fs.existsSync(sourcePath)) {
            return false;
        }
        
        const destDir = path.dirname(destPath);
        ensureDirectoryExists(destDir);
        
        fs.copyFileSync(sourcePath, destPath);
        return true;
    } catch (err) {
        logger.error(`Error copying file from ${sourcePath} to ${destPath}:`, err);
        return false;
    }
}

module.exports = {
    ensureDirectoryExists,
    readJsonFile,
    writeJsonFile,
    fileExists,
    listFiles,
    deleteFile,
    copyFile
};