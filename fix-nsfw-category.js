/**
 * NSFW Category JID Error Fix Script
 * This script fixes "jid.endsWith is not a function" errors in the NSFW command category
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

async function fixNsfwModule() {
  console.log('Fixing NSFW module...');
  
  const filePath = path.join(__dirname, 'src', 'commands', 'nsfw.js');
  
  if (!fs.existsSync(filePath)) {
    console.error(`NSFW module not found at ${filePath}`);
    return false;
  }
  
  const fileContent = await getFileContent(filePath);
  if (!fileContent) {
    console.error('Failed to read NSFW module file');
    return false;
  }
  
  // Add enhanced JID validation
  let updatedContent = fileContent;
  
  // Check if we need to add the JID helper imports
  if (!updatedContent.includes('isJidGroup')) {
    if (updatedContent.includes('require(\'../utils/jidHelper\')')) {
      // Add to existing import
      updatedContent = updatedContent.replace(
        /const\s*\{\s*([^}]*)\s*\}\s*=\s*require\(['"]\.\.\/utils\/jidHelper['"]\)/,
        'const { $1, isJidGroup, isJidUser, safeSendMessage, safeSendText, safeSendImage } = require(\'../utils/jidHelper\')'
      );
    } else {
      // Add new import
      updatedContent = updatedContent.replace(
        /(const|let|var|import)(.*)(\r?\n)/,
        '$1$2$3const { isJidGroup, isJidUser, safeSendMessage, safeSendText, safeSendImage } = require(\'../utils/jidHelper\');\n'
      );
    }
  }
  
  // Replace standard JID validation with safe helpers
  updatedContent = updatedContent.replace(
    /\bif\s*\(\s*([^.]+)\.endsWith\s*\(\s*['"]@g\.us['"]\s*\)\s*\)/g,
    'if (isJidGroup($1))'
  );
  
  updatedContent = updatedContent.replace(
    /\bif\s*\(\s*([^.]+)\.endsWith\s*\(\s*['"]@s\.whatsapp\.net['"]\s*\)\s*\)/g,
    'if (isJidUser($1))'
  );
  
  // Replace direct JID string operations with safe versions
  updatedContent = updatedContent.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\.endsWith\s*\(\s*['"]@g\.us['"]\s*\)/g,
    'isJidGroup($1)'
  );
  
  updatedContent = updatedContent.replace(
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\.endsWith\s*\(\s*['"]@s\.whatsapp\.net['"]\s*\)/g,
    'isJidUser($1)'
  );
  
  // Fix the group check in all NSFW commands
  updatedContent = updatedContent.replace(
    /const\s+remoteJid\s*=\s*sender\.key\.remoteJid/g,
    'const remoteJid = ensureJidString(sender.key.remoteJid)'
  );
  
  // Replace message sending
  updatedContent = updatedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*\{\s*image:\s*([^,]+),\s*caption:\s*([^}]+)\s*\}\s*\)/g,
    'await safeSendImage(sock, $1, $2, $3)'
  );
  
  updatedContent = updatedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*\{\s*text:\s*([^}]+)\s*\}\s*\)/g,
    'await safeSendText(sock, $1, $2)'
  );
  
  // General sendMessage cases
  updatedContent = updatedContent.replace(
    /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*\{([^}]+)\}\s*\)/g,
    'await safeSendMessage(sock, $1, {$2})'
  );
  
  if (updatedContent !== fileContent) {
    if (await writeFileContent(filePath, updatedContent)) {
      console.log('✅ Successfully fixed NSFW module!');
      return true;
    }
  } else {
    console.log('✓ No additional JID fixes needed for NSFW module');
    return true;
  }
  
  return false;
}

fixNsfwModule().then(success => {
  if (success) {
    console.log('NSFW module fix completed successfully');
  } else {
    console.error('Failed to fix NSFW module');
    process.exit(1);
  }
}).catch(err => {
  console.error('Error in fix process:', err);
  process.exit(1);
});