/**
 * Fix SafeSendMessage Usage in All Command Modules
 * This script scans all command files and ensures they properly use safeSendMessage functions
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Ensure the import statement doesn't duplicate if it already exists
 */
function ensureNoImportDuplication(content, importStmt) {
  const regex = new RegExp(importStmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (regex.test(content)) {
    return content;
  }
  
  // Add import statement after other imports
  const importSection = content.match(/^(const|let|var|import).*require.*$/m);
  if (importSection) {
    return content.replace(/^((?:const|let|var|import).*require.*$)/m, `$1\n${importStmt}`);
  }
  
  // If no imports found, add at the top
  return importStmt + '\n' + content;
}

/**
 * Fix sock.sendMessage calls in a file
 */
async function fixFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    const content = await readFile(filePath, 'utf8');
    
    // Check if file already uses the safeSendMessage imports
    const hasSafeSendMessage = /const\s+{\s*safeSendMessage\s*}/.test(content);
    const hasSafeSendText = /const\s+{\s*safeSendText\s*}/.test(content);
    const hasSafeSendImage = /const\s+{\s*safeSendImage\s*}/.test(content);
    
    let modifiedContent = content;
    
    // Count occurrences of unsafe sends
    const sockSendCount = (content.match(/sock\.sendMessage\s*\(/g) || []).length;
    
    // If file uses sock.sendMessage directly, we need to fix it
    if (sockSendCount > 0) {
      // Add import if needed
      if (!hasSafeSendMessage) {
        const importStmt = "const { safeSendMessage, safeSendText, safeSendImage } = require('../../utils/jidHelper');";
        modifiedContent = ensureNoImportDuplication(modifiedContent, importStmt);
      }
      
      // Replace direct sock.sendMessage with safeSendMessage
      // Regex matches sock.sendMessage(jid, { ... }); pattern
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
        /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*{\s*text:\s*(['"].*?['"]|\S+)\s*}\s*\)/g,
        'await safeSendText(sock, $1, $2)'
      );
      
      modifiedContent = modifiedContent.replace(
        /sock\.sendMessage\s*\(\s*([^,]+),\s*{\s*text:\s*(['"].*?['"]|\S+)\s*}\s*\)/g,
        'safeSendText(sock, $1, $2)'
      );
    }
    
    // Only write if changes were made
    if (modifiedContent !== content) {
      await writeFile(filePath, modifiedContent, 'utf8');
      console.log(`✅ Fixed ${sockSendCount} sendMessage calls in ${filePath}`);
      return true;
    } else {
      console.log(`✓ No fixes needed in ${filePath}`);
      return false;
    }
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err);
    return false;
  }
}

/**
 * Recursively scan a directory for command files
 */
async function scanDirectory(dir) {
  let fixed = 0;
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        fixed += await scanDirectory(fullPath);
      } else if (entry.name.endsWith('.js')) {
        if (await fixFile(fullPath)) {
          fixed++;
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err);
  }
  
  return fixed;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning for unsafe sendMessage calls...');
  
  const commandDirs = [
    path.join(__dirname, 'src', 'commands'),
    path.join(__dirname, 'src', 'handlers')
  ];
  
  let totalFixed = 0;
  
  for (const dir of commandDirs) {
    if (await fileExists(dir)) {
      const fixed = await scanDirectory(dir);
      totalFixed += fixed;
      console.log(`✅ Fixed ${fixed} files in ${dir}`);
    } else {
      console.warn(`⚠️ Directory not found: ${dir}`);
    }
  }
  
  console.log(`✅ Total: Fixed ${totalFixed} files with unsafe sendMessage calls`);
}

main().catch(err => {
  console.error('Error in main process:', err);
  process.exit(1);
});