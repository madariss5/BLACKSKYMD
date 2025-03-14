/**
 * Fix SafeSendText Usage in All Command Modules
 * This script ensures proper safeSendText usage across all files
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
    
    // Check if file already uses safeSendText
    const hasSafeSendText = content.includes('safeSendText');
    if (!hasSafeSendText) {
      console.log(`No safeSendText in ${filePath}, skipping`);
      return false;
    }
    
    // Fix incorrect safeSendText patterns
    // 1. Fix pattern with text as object: safeSendText(sock, jid, { text: "message" })
    let modifiedContent = content.replace(
      /safeSendText\s*\(\s*sock\s*,\s*([^,]+)\s*,\s*\{\s*text\s*:\s*([^}]+)\s*\}\s*\)/g,
      'safeSendText(sock, $1, $2)'
    );
    
    // 2. Fix pattern with missing parameters
    modifiedContent = modifiedContent.replace(
      /safeSendText\s*\(\s*([^,]+)\s*\)/g,
      'safeSendText(sock, remoteJid, $1)'
    );
    
    // Check safeSendText with remoteJid.key.remoteJid
    modifiedContent = modifiedContent.replace(
      /safeSendText\s*\(\s*sock\s*,\s*([^,]+)\.key\.remoteJid\s*,\s*([^)]+)\s*\)/g,
      'safeSendText(sock, $1.key.remoteJid, $2)'
    );
    
    // Only write if changes were made
    if (modifiedContent !== content) {
      await writeFile(filePath, modifiedContent, 'utf8');
      console.log(`✅ Fixed safeSendText in ${filePath}`);
      return true;
    } else {
      console.log(`✓ No fixes needed for safeSendText in ${filePath}`);
      return false;
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
    return false;
  }
}

async function main() {
  console.log('🔍 Scanning for incorrect safeSendText usage...');
  
  const commandDirs = [
    path.join(__dirname, 'src', 'commands'),
    path.join(__dirname, 'src', 'handlers')
  ];
  
  let totalFixed = 0;
  
  for (const dir of commandDirs) {
    try {
      const files = await findAllJsFiles(dir);
      console.log(`Found ${files.length} JS files in ${dir}`);
      
      for (const file of files) {
        if (await fixFile(file)) {
          totalFixed++;
        }
      }
      
      console.log(`✅ Fixed ${totalFixed} files in ${dir}`);
    } catch (err) {
      console.error(`Error processing directory ${dir}:`, err);
    }
  }
  
  console.log(`✅ Total: Fixed ${totalFixed} files with incorrect safeSendText usage`);
}

async function findAllJsFiles(dir) {
  const result = [];
  
  async function scan(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.name.endsWith('.js')) {
        result.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return result;
}

main().catch(err => {
  console.error('Error in main process:', err);
  process.exit(1);
});