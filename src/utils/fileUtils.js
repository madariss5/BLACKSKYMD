/**
 * File Utilities
 * Provides helper functions for file operations
 */

const fs = require('fs');
const path = require('path');

/**
 * Ensure a directory exists, creating it if it doesn't
 * @param {string} dir - Directory path
 * @returns {boolean} - Whether the directory exists after the operation
 */
function ensureDirectoryExists(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[INFO] Created directory: ${dir}`);
    }
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to create directory ${dir}: ${error.message}`);
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
  } catch (error) {
    console.error(`[ERROR] Failed to read JSON file ${filePath}: ${error.message}`);
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
    // Ensure directory exists
    const dir = path.dirname(filePath);
    ensureDirectoryExists(dir);
    
    // Write file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to write JSON file ${filePath}: ${error.message}`);
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
  } catch (error) {
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
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      
      // If it's a directory and recursive is true, recurse
      if (dirent.isDirectory() && options.recursive) {
        return listFiles(res, options);
      }
      
      // If it's a file, check extensions if specified
      if (dirent.isFile()) {
        if (options.extensions && options.extensions.length > 0) {
          const ext = path.extname(res).toLowerCase();
          if (options.extensions.includes(ext)) {
            return res;
          }
          return null;
        }
        return res;
      }
      
      return null;
    }));
    
    // Flatten the array and filter out null values
    return files.flat().filter(Boolean);
  } catch (error) {
    console.error(`[ERROR] Failed to list files in ${dir}: ${error.message}`);
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
    if (!fs.existsSync(filePath)) {
      return true; // File doesn't exist, consider it "deleted"
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to delete file ${filePath}: ${error.message}`);
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
      console.error(`[ERROR] Source file does not exist: ${sourcePath}`);
      return false;
    }
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    ensureDirectoryExists(destDir);
    
    // Copy file
    fs.copyFileSync(sourcePath, destPath);
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to copy file from ${sourcePath} to ${destPath}: ${error.message}`);
    return false;
  }
}

/**
 * Get the size of a file in bytes
 * @param {string} filePath - Path to file
 * @returns {number} - File size in bytes, or -1 if error
 */
function getFileSize(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return -1;
    }
    
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`[ERROR] Failed to get file size for ${filePath}: ${error.message}`);
    return -1;
  }
}

/**
 * Format a file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === -1 || bytes === undefined) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = {
  ensureDirectoryExists,
  readJsonFile,
  writeJsonFile,
  fileExists,
  listFiles,
  deleteFile,
  copyFile,
  getFileSize,
  formatFileSize
};