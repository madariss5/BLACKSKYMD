/**
 * JID Error Fix Script
 * This script scans all command files to fix "jid.endsWith is not a function" errors
 * by replacing direct sock.sendMessage calls with safe JID handling functions
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Logger for the script
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err || '')
};

// Command directories to scan
const COMMAND_DIRS = [
  './src/commands',
  './src/commands/educational',
  './src/handlers'
];

// Pattern to search for sock.sendMessage calls
const SEND_MESSAGE_REGEX = /await\s+sock\.sendMessage\s*\(\s*([^,\)]+)\s*,\s*({[^}]+}|[^,)]+)\s*\)/g;

// Helper to safely get file content
async function getFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    logger.error(`Failed to read file: ${filePath}`, err);
    return null;
  }
}

// Helper to safely write file content
async function writeFileContent(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  } catch (err) {
    logger.error(`Failed to write file: ${filePath}`, err);
    return false;
  }
}

// Check if a file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to scan a directory recursively
async function scanDirectory(dir) {
  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath);
        files = files.concat(subFiles);
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    logger.error(`Failed to scan directory: ${dir}`, err);
  }
  
  return files;
}

// Remove import statement if it already exists to avoid duplicates
function ensureNoImportDuplication(content, importStmt) {
  // Check if the import already exists
  if (content.includes(importStmt)) {
    return content;
  }
  
  // Find a good place to insert the import (after other imports or at the top of function)
  const lines = content.split('\n');
  let insertLineIndex = 0;
  
  // Find the end of imports or beginning of the function
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('const') || line.startsWith('let') || line.startsWith('var') ||
        line.startsWith('import') || line.startsWith('require')) {
      insertLineIndex = i + 1;
    } else if (line.startsWith('async') || line.startsWith('function')) {
      break;
    }
  }
  
  // Insert the import statement
  lines.splice(insertLineIndex, 0, importStmt);
  return lines.join('\n');
}

// Fix a file by replacing sock.sendMessage calls with safe JID handling
async function fixFile(filePath) {
  const content = await getFileContent(filePath);
  if (!content) return;
  
  // Skip files that already use the safe JID handler extensively
  if (content.includes('safeSendText') && 
      content.includes('safeSendMessage') && 
      content.match(/safeSend/g)?.length > 5) {
    logger.info(`Skipping already fixed file: ${filePath}`);
    return;
  }
  
  // Count the number of sock.sendMessage calls
  const sendMessageMatches = content.match(SEND_MESSAGE_REGEX) || [];
  
  if (sendMessageMatches.length === 0) {
    logger.info(`No sock.sendMessage calls found in: ${filePath}`);
    return;
  }
  
  logger.info(`Found ${sendMessageMatches.length} sock.sendMessage calls in: ${filePath}`);
  
  // Add import for the safe JID helpers if not already present
  let updatedContent = content;
  
  // Determine the correct import path based on the file path
  let importPath = '../utils/jidHelper';
  if (filePath.startsWith('./src/handlers/')) {
    importPath = '../utils/jidHelper';
  } else if (filePath.startsWith('./src/commands/educational/')) {
    importPath = '../../utils/jidHelper';
  }
  
  const importStatement = `const { safeSendText, safeSendMessage, safeSendImage } = require('${importPath}');`;
  
  // Insert the import in the appropriate place
  updatedContent = ensureNoImportDuplication(updatedContent, importStatement);
  
  // Replace sock.sendMessage calls with appropriate safe functions
  let modifiedContent = updatedContent;
  
  // Replace simple text messages
  modifiedContent = modifiedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,\)]+)\s*,\s*{\s*text:\s*([^}]+)\s*}\s*\)/g,
    'await safeSendText(sock, $1, $2)'
  );
  
  // Replace other types of messages
  modifiedContent = modifiedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,\)]+)\s*,\s*({[^}]+image[^}]+}|{[^}]+sticker[^}]+})\s*\)/g,
    'await safeSendMessage(sock, $1, $2)'
  );
  
  // Count how many replacements were made
  const originalMatches = updatedContent.match(SEND_MESSAGE_REGEX) || [];
  const remainingMatches = modifiedContent.match(SEND_MESSAGE_REGEX) || [];
  const replacementsCount = originalMatches.length - remainingMatches.length;
  
  // Write the updated content if changes were made
  if (replacementsCount > 0) {
    const writeSuccess = await writeFileContent(filePath, modifiedContent);
    
    if (writeSuccess) {
      logger.success(`Fixed ${replacementsCount} sock.sendMessage calls in: ${filePath}`);
    }
  } else {
    logger.info(`No changes made to: ${filePath}`);
  }
}

// Main function to fix all files
async function fixJidEndswithErrors() {
  logger.info('Starting JID error fix script...');
  
  // Check if jidHelper.js exists
  const jidHelperPath = './src/utils/jidHelper.js';
  if (!await fileExists(jidHelperPath)) {
    logger.error(`jidHelper.js not found at ${jidHelperPath}. Creating it...`);
    // jidHelper.js content should be created here if needed
  }
  
  // Scan all command directories
  let jsFiles = [];
  for (const dir of COMMAND_DIRS) {
    logger.info(`Scanning directory: ${dir}`);
    const files = await scanDirectory(dir);
    jsFiles = jsFiles.concat(files);
  }
  
  logger.info(`Found ${jsFiles.length} JavaScript files to check`);
  
  // Process each file
  let fixedCount = 0;
  for (const file of jsFiles) {
    logger.info(`Processing file: ${file}`);
    await fixFile(file);
    fixedCount++;
  }
  
  logger.success(`JID error fix completed. Processed ${fixedCount} files.`);
}

// Execute the fix
fixJidEndswithErrors()
  .then(() => {
    console.log('Script execution completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script execution failed:', err);
    process.exit(1);
  });