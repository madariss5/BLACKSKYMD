/**
 * NSFW Category JID Error Fix Script
 * This script fixes "jid.endsWith is not a function" errors in the NSFW command category
 */

const fs = require('fs').promises;
const path = require('path');

// Logger for the script
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err || '')
};

// Path to the NSFW module
const NSFW_MODULE_PATH = './src/commands/nsfw.js';

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

// Fix the NSFW module
async function fixNsfwModule() {
  logger.info('Starting NSFW module JID error fix...');
  
  // Get the NSFW module content
  const content = await getFileContent(NSFW_MODULE_PATH);
  if (!content) {
    logger.error('Failed to read NSFW module');
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
  
  // Fix the commands one by one
  const commands = [
    'isNSFW', 'nsfwSettings', 'nsfwStats', 'verify', 'nsfwHelp',
    'waifu', 'neko', 'hentai', 'boobs', 'pussy', 'blowjob', 'anal', 'feet',
    'gifboobs', 'gifhentai', 'gifblowjob', 'uniform', 'thighs', 'femdom',
    'tentacle', 'pantsu', 'kitsune'
  ];
  
  for (const command of commands) {
    // Find the command function
    const commandRegex = new RegExp(`async\\s+${command}\\s*\\(sock,\\s*sender(?:,\\s*args)?\\)\\s*{`, 'g');
    
    if (commandRegex.test(updatedContent)) {
      // Find the function body
      const functionStartIndex = updatedContent.search(commandRegex);
      if (functionStartIndex === -1) continue;
      
      // Get the function content
      let openBraces = 0;
      let closeBraces = 0;
      let endIndex = functionStartIndex;
      
      // Find the end of the function
      for (let i = functionStartIndex; i < updatedContent.length; i++) {
        if (updatedContent[i] === '{') openBraces++;
        if (updatedContent[i] === '}') {
          closeBraces++;
          if (openBraces === closeBraces) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      const functionBody = updatedContent.substring(functionStartIndex, endIndex);
      
      // Skip already fixed functions
      if (functionBody.includes('safeSendText') || functionBody.includes('safeSendMessage')) {
        logger.info(`Command ${command} already fixed, skipping`);
        continue;
      }
      
      // Fix the function body
      let fixedBody = functionBody;
      
      // Replace simple text messages
      fixedBody = fixedBody.replace(
        /await\s+sock\.sendMessage\s*\(\s*sender\s*,\s*{\s*text:\s*([^}]+)\s*}\s*\)/g,
        'await safeSendText(sock, sender, $1)'
      );
      
      // Replace image messages
      fixedBody = fixedBody.replace(
        /await\s+sock\.sendMessage\s*\(\s*sender\s*,\s*{\s*image:([^}]+),\s*caption:([^}]+)\s*}\s*\)/g,
        'await safeSendMessage(sock, sender, { image:$1, caption:$2 })'
      );
      
      // Replace other messages
      fixedBody = fixedBody.replace(
        /await\s+sock\.sendMessage\s*\(\s*sender\s*,\s*({[^}]+})\s*\)/g,
        'await safeSendMessage(sock, sender, $1)'
      );
      
      // Update the content
      if (fixedBody !== functionBody) {
        updatedContent = updatedContent.replace(functionBody, fixedBody);
        logger.success(`Fixed command: ${command}`);
      } else {
        logger.info(`No changes needed for command: ${command}`);
      }
    } else {
      logger.info(`Command ${command} not found`);
    }
  }
  
  // Add JID helper import to the function if it's missing
  const functionRegex = /async\s+function\s+sendNsfwGif\s*\(sock,\s*sender,\s*url,\s*caption\)\s*{/g;
  if (functionRegex.test(updatedContent)) {
    // Find the function body
    const functionStartIndex = updatedContent.search(functionRegex);
    if (functionStartIndex !== -1) {
      // Get function start line
      const lines = updatedContent.substring(0, functionStartIndex).split('\n');
      const functionStartLine = lines.length;
      
      // Replace the function with a fixed version
      const allLines = updatedContent.split('\n');
      if (!allLines[functionStartLine].includes('safeSendText') && 
          !allLines[functionStartLine].includes('safeSendMessage')) {
        
        // Add the import
        allLines.splice(functionStartLine, 0, "    const { safeSendText, safeSendMessage } = require('../utils/jidHelper');");
        
        // Update the function content
        let inFunction = false;
        for (let i = functionStartLine; i < allLines.length; i++) {
          if (allLines[i].includes('sendNsfwGif')) {
            inFunction = true;
          }
          
          if (inFunction) {
            // Replace sock.sendMessage with safeSendMessage
            allLines[i] = allLines[i].replace(
              /sock\.sendMessage\s*\(\s*normalizedJid\s*,/g,
              'safeSendMessage(sock, sender,'
            );
            
            // Replace sock.sendMessage in catch block
            allLines[i] = allLines[i].replace(
              /sock\.sendMessage\s*\(\s*fallbackJid\s*,\s*{\s*text:\s*([^}]+)\s*}\s*\)/g,
              'safeSendText(sock, sender, $1)'
            );
            
            // Exit when we reach end of function
            if (allLines[i].trim() === '}' && inFunction) {
              inFunction = false;
              break;
            }
          }
        }
        
        updatedContent = allLines.join('\n');
        logger.success('Fixed sendNsfwGif function');
      }
    }
  }
  
  // Write the updated content
  const writeSuccess = await writeFileContent(NSFW_MODULE_PATH, updatedContent);
  
  if (writeSuccess) {
    logger.success('Successfully fixed NSFW module');
  } else {
    logger.error('Failed to write updated NSFW module');
  }
}

// Execute the fix
fixNsfwModule()
  .then(() => {
    console.log('NSFW module fix completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script execution failed:', err);
    process.exit(1);
  });