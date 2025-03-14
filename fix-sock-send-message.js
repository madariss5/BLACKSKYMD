/**
 * Fix sock.sendMessage in Utils Directory
 * This script focuses on fixing any remaining sock.sendMessage calls in utils
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

async function fixFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    const content = await readFile(filePath, 'utf8');
    
    // Skip jidHelper.js since it contains the safe functions
    if (filePath.endsWith('jidHelper.js')) {
      console.log(`Skipping jidHelper.js which contains the implementation`);
      return false;
    }
    
    // Count sock.sendMessage occurrences
    const sockSendCount = (content.match(/sock\.sendMessage\s*\(/g) || []).length;
    
    if (sockSendCount === 0) {
      console.log(`No sock.sendMessage in ${filePath}, skipping`);
      return false;
    }
    
    // Check if file already has the imports
    const hasSafeSendImport = /safeSendMessage|safeSendText|safeSendImage/.test(content);
    
    // Add import if needed
    let modifiedContent = content;
    if (!hasSafeSendImport) {
      const importPath = '../utils/jidHelper';
      // If the file is in utils, adjust the import path
      if (filePath.includes('/utils/')) {
        modifiedContent = modifiedContent.replace(
          /(const\s+[^;]+\s*=\s*require\([^)]+\);)/,
          '$1\nconst { safeSendMessage, safeSendText, safeSendImage } = require(\'./jidHelper\');'
        );
      } else {
        modifiedContent = modifiedContent.replace(
          /(const\s+[^;]+\s*=\s*require\([^)]+\);)/,
          '$1\nconst { safeSendMessage, safeSendText, safeSendImage } = require(\'../utils/jidHelper\');'
        );
      }
    }
    
    // Replace direct sock.sendMessage with safeSendMessage
    modifiedContent = modifiedContent.replace(
      /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*({[^}]+})\s*\)/g, 
      'await safeSendMessage(sock, $1, $2)'
    );
    
    // Also fix non-await version
    modifiedContent = modifiedContent.replace(
      /sock\.sendMessage\s*\(\s*([^,]+),\s*({[^}]+})\s*\)/g, 
      'safeSendMessage(sock, $1, $2)'
    );
    
    // Also fix text sends
    modifiedContent = modifiedContent.replace(
      /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*{\s*text:\s*([^}]+)\s*}\s*\)/g,
      'await safeSendText(sock, $1, $2)'
    );
    
    modifiedContent = modifiedContent.replace(
      /sock\.sendMessage\s*\(\s*([^,]+),\s*{\s*text:\s*([^}]+)\s*}\s*\)/g,
      'safeSendText(sock, $1, $2)'
    );
    
    // Only write if changes were made
    if (modifiedContent !== content) {
      await writeFile(filePath, modifiedContent, 'utf8');
      console.log(`✅ Fixed ${sockSendCount} sock.sendMessage calls in ${filePath}`);
      return true;
    } else {
      console.log(`No changes made to ${filePath} despite ${sockSendCount} sock.sendMessage calls`);
      return false;
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
    return false;
  }
}

async function main() {
  console.log('🔍 Scanning for sock.sendMessage in utils...');
  
  const utilsDir = path.join(__dirname, 'src', 'utils');
  
  if (!fs.existsSync(utilsDir)) {
    console.error(`❌ Utils directory not found at ${utilsDir}`);
    return;
  }
  
  try {
    const files = await readdir(utilsDir);
    let fixedCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(utilsDir, file);
        if (await fixFile(filePath)) {
          fixedCount++;
        }
      }
    }
    
    console.log(`✅ Fixed ${fixedCount} files in utils directory`);
  } catch (err) {
    console.error(`Error scanning utils directory:`, err);
  }
}

main().catch(err => {
  console.error('Error in main process:', err);
  process.exit(1);
});