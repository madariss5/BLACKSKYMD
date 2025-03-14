/**
 * Fix SafeSendMessage Usage in All Command Modules
 * This script scans all command files and ensures they properly use safeSendMessage functions
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = promisify(fs.exists);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Pattern to identify direct sock.sendMessage calls
const DIRECT_SEND_PATTERN = /await\s+sock\.sendMessage\s*\(\s*(\w+)/g;

// Pattern to identify missing jidHelper imports
const JIDHELPER_IMPORT_PATTERN = /require\s*\(\s*['"]\.\.\/utils\/jidHelper['"]\s*\)/;

// Commands directory
const COMMANDS_DIR = path.join(__dirname, 'src', 'commands');

// Stats tracking
const stats = {
  filesScanned: 0,
  filesFixed: 0,
  sendMessageCallsFixed: 0,
  errors: [],
};

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    return await existsAsync(filePath);
  } catch (err) {
    return false;
  }
}

/**
 * Ensure the import statement doesn't duplicate if it already exists
 */
function ensureNoImportDuplication(content, importStmt) {
  // If the module already has the import, don't add it again
  if (content.includes(importStmt) || 
      JIDHELPER_IMPORT_PATTERN.test(content)) {
    return content;
  }
  
  // Find a good place to add the import (after other imports)
  const lines = content.split('\n');
  let lastImportLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('require(') && !lines[i].includes('//')) {
      lastImportLine = i;
    }
  }
  
  if (lastImportLine >= 0) {
    lines.splice(lastImportLine + 1, 0, importStmt);
    return lines.join('\n');
  }
  
  // If no good place found, add it to the top
  return importStmt + '\n' + content;
}

/**
 * Fix sock.sendMessage calls in a file
 */
async function fixFile(filePath) {
  try {
    // Read file content
    const content = await readFileAsync(filePath, 'utf8');
    let modified = false;
    let newContent = content;
    
    // Check if the file uses sock.sendMessage
    const hasSendMessageCalls = DIRECT_SEND_PATTERN.test(content);
    
    // Reset the regex lastIndex
    DIRECT_SEND_PATTERN.lastIndex = 0;
    
    if (hasSendMessageCalls) {
      console.log(`Processing ${filePath} - Contains direct sock.sendMessage calls`);
      
      // Add import for jidHelper if needed
      const jidHelperImport = "const { safeSendMessage, safeSendText, safeSendImage } = require('../utils/jidHelper');";
      newContent = ensureNoImportDuplication(newContent, jidHelperImport);
      
      // Replace sock.sendMessage with safeSendMessage where needed
      let match;
      let replaceCount = 0;
      
      // Extract all sock.sendMessage calls and create a separate newContent with replacements
      const extracted = [];
      DIRECT_SEND_PATTERN.lastIndex = 0;
      while ((match = DIRECT_SEND_PATTERN.exec(content)) !== null) {
        extracted.push({
          fullMatch: match[0],
          jid: match[1],
          index: match.index
        });
      }
      
      // Sort by index in reverse order to avoid messing up indices while replacing
      extracted.sort((a, b) => b.index - a.index);
      
      // Now make replacements in reverse order
      for (const item of extracted) {
        // Skip if it's part of a function call like safeSendMessage
        const segment = newContent.substring(Math.max(0, item.index - 20), item.index);
        if (segment.includes('safeSendMessage') || 
            segment.includes('safeSendText') || 
            segment.includes('safeSendImage')) {
          continue;
        }
        
        // Replace the direct sock.sendMessage call
        const prefixPart = newContent.substring(0, item.index);
        const postfixPart = newContent.substring(item.index + item.fullMatch.length);
        
        newContent = prefixPart + 
                    `await safeSendMessage(sock, ${item.jid}` + 
                    postfixPart;
        
        replaceCount++;
      }
      
      if (replaceCount > 0) {
        console.log(`  - Fixed ${replaceCount} sendMessage calls`);
        stats.sendMessageCallsFixed += replaceCount;
        modified = true;
      } else {
        console.log('  - No unsafe sendMessage calls found');
      }
      
      if (modified) {
        await writeFileAsync(filePath, newContent, 'utf8');
        console.log(`✅ Successfully updated ${filePath}`);
        stats.filesFixed++;
      }
    }
    
    stats.filesScanned++;
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err);
    stats.errors.push({ file: filePath, error: err.message });
  }
}

/**
 * Recursively scan a directory for command files
 */
async function scanDirectory(dir) {
  try {
    const entries = await readdirAsync(dir);
    
    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      const stat = await statAsync(entryPath);
      
      if (stat.isDirectory()) {
        await scanDirectory(entryPath);
      } else if (entry.endsWith('.js') && !entry.startsWith('.')) {
        await fixFile(entryPath);
      }
    }
  } catch (err) {
    console.error(`❌ Error scanning directory ${dir}:`, err);
    stats.errors.push({ dir, error: err.message });
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning command files for unsafe sendMessage calls...');
  
  try {
    await scanDirectory(COMMANDS_DIR);
    
    console.log('\n📊 Fix Summary:');
    console.log(`Total files scanned: ${stats.filesScanned}`);
    console.log(`Files fixed: ${stats.filesFixed}`);
    console.log(`Total sendMessage calls fixed: ${stats.sendMessageCallsFixed}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((err, i) => {
        console.log(`  ${i+1}. ${err.file || err.dir}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Process completed successfully');
  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

// Run the script
main();