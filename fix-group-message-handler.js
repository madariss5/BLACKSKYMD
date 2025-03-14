/**
 * Group Message Handler JID Error Fix Script
 * This script fixes "jid.endsWith is not a function" errors in the group message handler
 */

const fs = require('fs').promises;
const path = require('path');

// Logger for the script
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err || '')
};

// Path to the group message handler
const GROUP_MESSAGE_HANDLER_PATH = './src/handlers/groupMessageHandler.js';

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

// Fix the group message handler
async function fixGroupMessageHandler() {
  logger.info('Starting group message handler JID error fix...');
  
  // Get the group message handler content
  const content = await getFileContent(GROUP_MESSAGE_HANDLER_PATH);
  if (!content) {
    logger.error('Failed to read group message handler');
    return;
  }
  
  // Add the import for the JID helpers if not already present
  let updatedContent = content;
  const importStatement = "const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');";
  
  if (!updatedContent.includes('safeSendText') && !updatedContent.includes('safeSendMessage')) {
    // Find a good place to add the import
    const lines = updatedContent.split('\n');
    let importLine = 0;
    
    // Find the end of imports or beginning of code
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('const ') || line.startsWith('let ') || line.startsWith('var ')) {
        importLine = i + 1;
      } else if (line.includes('function ') || line.includes('class ')) {
        break;
      }
    }
    
    // Insert the import
    lines.splice(importLine, 0, importStatement);
    updatedContent = lines.join('\n');
    logger.info('Added JID helper import');
  }
  
  // Replace sock.sendMessage calls with safeSendText/safeSendMessage
  
  // Replace simple text messages
  updatedContent = updatedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,\)]+)\s*,\s*{\s*text:\s*([^}]+)\s*}\s*\)/g,
    'await safeSendText(sock, $1, $2)'
  );
  
  // Replace sock.sendMessage with other content types
  updatedContent = updatedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,\)]+)\s*,\s*({[^}]+image[^}]+}|{[^}]+sticker[^}]+})\s*\)/g,
    'await safeSendMessage(sock, $1, $2)'
  );
  
  // Replace any remaining sock.sendMessage calls
  updatedContent = updatedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,\)]+)\s*,\s*({[^}]+})\s*\)/g,
    'await safeSendMessage(sock, $1, $2)'
  );
  
  // Count how many replacements were made
  const originalCallCount = (content.match(/sock\.sendMessage/g) || []).length;
  const remainingCallCount = (updatedContent.match(/sock\.sendMessage/g) || []).length;
  const fixedCount = originalCallCount - remainingCallCount;
  
  if (fixedCount > 0) {
    // Write the updated content
    const writeSuccess = await writeFileContent(GROUP_MESSAGE_HANDLER_PATH, updatedContent);
    
    if (writeSuccess) {
      logger.success(`Fixed ${fixedCount} sock.sendMessage calls in group message handler`);
    } else {
      logger.error('Failed to write updated group message handler');
    }
  } else {
    logger.info('No changes needed in group message handler');
  }
}

// Execute the fix
fixGroupMessageHandler()
  .then(() => {
    console.log('Group message handler fix completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script execution failed:', err);
    process.exit(1);
  });