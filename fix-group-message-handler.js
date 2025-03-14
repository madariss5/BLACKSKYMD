/**
 * Group Message Handler JID Error Fix Script
 * This script fixes "jid.endsWith is not a function" errors in the group message handler
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

async function getFileContent(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
}

async function writeFileContent(filePath, content) {
  try {
    await writeFile(filePath, content, 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
    return false;
  }
}

async function fixGroupMessageHandler() {
  console.log('Fixing group message handler...');
  
  const filePath = path.join(__dirname, 'src', 'handlers', 'groupMessageHandler.js');
  
  const fileContent = await getFileContent(filePath);
  if (!fileContent) {
    console.error('Failed to read group message handler file');
    return false;
  }
  
  // Add enhanced JID validation
  let updatedContent = fileContent;
  
  // Check if we need to add the isJidGroup import
  if (!updatedContent.includes('isJidGroup')) {
    updatedContent = updatedContent.replace(
      /^(const|let|var|import)(.*)$/m,
      '$1$2\nconst { isJidGroup, ensureJidString, safeSendText, safeSendMessage } = require(\'../utils/jidHelper\');'
    );
  }
  
  // Replace standard JID validation with safe helpers
  updatedContent = updatedContent.replace(
    /\bif\s*\(\s*([^.]+)\.endsWith\s*\(\s*['"]@g\.us['"]\s*\)\s*\)/g,
    'if (isJidGroup($1))'
  );
  
  // Replace direct JID string operations with safe versions
  updatedContent = updatedContent.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\.endsWith\s*\(\s*['"]@g\.us['"]\s*\)/g,
    'isJidGroup($1)'
  );
  
  // Add JID safety to message sender functions
  updatedContent = updatedContent.replace(
    /sock\.sendMessage\s*\(\s*([^,]+),\s*\{([^}]+)\}\s*\)/g,
    'safeSendMessage(sock, $1, {$2})'
  );
  
  // Add safe text sending
  updatedContent = updatedContent.replace(
    /sock\.sendMessage\s*\(\s*([^,]+),\s*\{\s*text:\s*([^}]+)\s*\}\s*\)/g,
    'safeSendText(sock, $1, $2)'
  );
  
  // Fix all instances where JID is used directly without validation
  updatedContent = updatedContent.replace(
    /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*message\.key\.remoteJid/g,
    'const $1 = ensureJidString(message.key.remoteJid)'
  );
  
  if (updatedContent !== fileContent) {
    if (await writeFileContent(filePath, updatedContent)) {
      console.log('✅ Successfully fixed group message handler!');
      return true;
    }
  } else {
    console.log('✓ No additional JID fixes needed for group message handler');
    return true;
  }
  
  return false;
}

fixGroupMessageHandler().then(success => {
  if (success) {
    console.log('Group message handler fix completed successfully');
  } else {
    console.error('Failed to fix group message handler');
    process.exit(1);
  }
}).catch(err => {
  console.error('Error in fix process:', err);
  process.exit(1);
});