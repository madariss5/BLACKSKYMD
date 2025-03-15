/**
 * Comprehensive SafeSendMessage Fix Script
 * This script scans all JS files in the project and fixes any direct sock.sendMessage calls
 * by replacing them with the proper safeSendMessage wrappers
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

// Stats
let filesScanned = 0;
let filesModified = 0;
let sendMessageCallsFixed = 0;
let filesFailed = 0;

// Regex patterns
const SOCK_SEND_REGEX = /sock\.sendMessage\s*\(/g;
const DIRECT_SEND_REGEX = /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*({[^}]+})\s*\)/g;
const TEXT_SEND_REGEX = /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*{\s*text:\s*([^}]+)\s*}\s*\)/g;
const IMAGE_SEND_REGEX = /await\s+sock\.sendMessage\s*\(\s*([^,]+),\s*{\s*image:\s*([^,}]+)(?:,\s*caption:\s*([^}]+))?\s*}\s*\)/g;

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} - Whether file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Ensure the import statement doesn't duplicate if it already exists
 * @param {string} content - File content
 * @param {string} importStmt - Import statement to check
 * @returns {string} - Modified content
 */
function ensureNoImportDuplication(content, importStmt) {
  // Skip if already has the specific import
  const importPatterns = [
    /const\s+{\s*safeSendMessage\s*}/,
    /const\s+{\s*safeSendText\s*}/,
    /require\(['"]\.\.\/?utils\/jidHelper['"]\)/,
    /safeSendMessage.*?jidHelper/
  ];
  
  if (importPatterns.some(pattern => pattern.test(content))) {
    console.log('  - Already has import statement');
    return content;
  }
  
  // Find a good place to insert the import
  const lines = content.split('\n');
  let insertIndex = 0;
  let modified = '';
  
  // Look for the last require statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('require(') && !lines[i].includes('=') && lines[i].trim().startsWith('//')) {
      continue; // Skip commented out require statements
    }
    
    if (lines[i].includes('require(')) {
      insertIndex = i + 1;
    }
  }
  
  if (insertIndex > 0) {
    // Insert after the last require statement
    lines.splice(insertIndex, 0, importStmt);
    modified = lines.join('\n');
  } else {
    // If no requires found, add at the top
    // Find the end of any comment block at the top
    let commentEndIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('*/')) {
        commentEndIndex = i + 1;
        break;
      }
      // If seeing a non-comment, non-empty line, stop
      if (lines[i].trim() !== '' && !lines[i].trim().startsWith('*') && !lines[i].trim().startsWith('//')) {
        break;
      }
    }
    
    lines.splice(commentEndIndex, 0, importStmt);
    modified = lines.join('\n');
  }
  
  return modified;
}

/**
 * Fix a file by replacing direct sock.sendMessage calls with safeSendMessage
 * @param {string} filePath - File to fix
 * @returns {Promise<boolean>} - Whether file was modified
 */
async function fixFile(filePath) {
  try {
    if (filePath.includes('node_modules') || 
        filePath.includes('test') || 
        filePath.includes('.git') ||
        filePath.endsWith('.json') ||
        filePath.endsWith('.md')) {
      return false;
    }

    // Skip files that implement the safe functions themselves
    if (filePath.endsWith('jidHelper.js')) {
      console.log(`Skipping jidHelper.js - contains implementation`);
      return false;
    }
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    filesScanned++;
    
    // Count direct sock.sendMessage calls
    const directCalls = (content.match(SOCK_SEND_REGEX) || []).length;
    
    if (directCalls === 0) {
      return false;
    }
    
    console.log(`Processing: ${filePath} (${directCalls} direct calls)`);
    
    // Determine the right import path
    let importPath = '../utils/jidHelper';
    if (filePath.includes('/utils/')) {
      importPath = './jidHelper';
    } else if (filePath.includes('/commands/educational/')) {
      importPath = '../../utils/jidHelper';
    } else if (filePath.includes('/commands/')) {
      importPath = '../utils/jidHelper';
    }
    
    // Create import statement
    const importStmt = `const { safeSendMessage, safeSendText, safeSendImage } = require('${importPath}');`;
    
    // Add import if needed
    let modifiedContent = content;
    if (!modifiedContent.includes('safeSendMessage') || !modifiedContent.includes('jidHelper')) {
      modifiedContent = ensureNoImportDuplication(modifiedContent, importStmt);
    }
    
    // Replace direct sock.sendMessage with safeSendMessage
    const originalContent = modifiedContent;
    
    // Fix text messages specifically first
    modifiedContent = modifiedContent.replace(
      TEXT_SEND_REGEX,
      'await safeSendText(sock, $1, $2)'
    );
    
    // Fix image messages specifically
    modifiedContent = modifiedContent.replace(
      IMAGE_SEND_REGEX,
      (match, jid, image, caption) => {
        if (caption) {
          return `await safeSendImage(sock, ${jid}, ${image}, ${caption})`;
        } else {
          return `await safeSendImage(sock, ${jid}, ${image})`;
        }
      }
    );
    
    // Fix general message sends
    modifiedContent = modifiedContent.replace(
      DIRECT_SEND_REGEX,
      'await safeSendMessage(sock, $1, $2)'
    );
    
    // Also fix non-await versions
    modifiedContent = modifiedContent.replace(
      /sock\.sendMessage\s*\(\s*([^,]+),\s*({[^}]+})\s*\)/g,
      'safeSendMessage(sock, $1, $2)'
    );
    
    // Only write if changes were made
    if (modifiedContent !== originalContent) {
      await fs.writeFile(filePath, modifiedContent, 'utf8');
      
      const fixedCount = (originalContent.match(SOCK_SEND_REGEX) || []).length - 
                         (modifiedContent.match(SOCK_SEND_REGEX) || []).length;
      
      filesModified++;
      sendMessageCallsFixed += fixedCount;
      
      console.log(`  ✅ Fixed ${fixedCount} calls in ${filePath}`);
      return true;
    } else if (directCalls > 0) {
      console.log(`  ⚠️ Found ${directCalls} calls but couldn't fix them in ${filePath}`);
    }
    
    return false;
  } catch (error) {
    console.error(`  ❌ Error fixing ${filePath}: ${error.message}`);
    filesFailed++;
    return false;
  }
}

/**
 * Recursively process all JS files in a directory
 * @param {string} dir - Directory to process
 * @returns {Promise<number>} - Number of files processed
 */
async function processDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let count = 0;
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, etc.
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        
        count += await processDirectory(fullPath);
      } else if (entry.name.endsWith('.js')) {
        if (await fixFile(fullPath)) {
          count++;
        }
      }
    }
    
    return count;
  } catch (error) {
    console.error(`Error processing directory ${dir}: ${error.message}`);
    return 0;
  }
}

/**
 * Find all direct sock.sendMessage calls
 */
async function findDirectSendMessageCalls() {
  try {
    console.log('\n🔍 Finding all files with direct sock.sendMessage calls...');
    
    // Use grep to find all occurrences
    const { stdout } = await execPromise(
      `grep -r "sock.sendMessage" --include="*.js" /home/runner/workspace | grep -v "jidHelper.js" | grep -v "fix-"`
    );
    
    console.log('\nFiles with direct sock.sendMessage calls:');
    const lines = stdout.split('\n').filter(line => line.trim() !== '');
    
    lines.forEach(line => {
      console.log(line);
    });
    
    return lines.map(line => line.split(':')[0]);
  } catch (error) {
    // No grep results
    console.log('No direct sock.sendMessage calls found.');
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🛠️ Starting comprehensive safeSendMessage fix');
  
  // First find all direct calls
  const filesWithDirectCalls = await findDirectSendMessageCalls();
  
  // Check jidHelper.js existence
  const jidHelperPath = '/home/runner/workspace/src/utils/jidHelper.js';
  if (!await fileExists(jidHelperPath)) {
    console.error('❌ ERROR: jidHelper.js not found! Cannot proceed with fixes.');
    return;
  }
  
  console.log(`\n🔧 Processing ${filesWithDirectCalls.length} files with direct calls...`);
  
  // Process each file directly first
  for (const filePath of filesWithDirectCalls) {
    await fixFile(filePath);
  }
  
  // Now process all directories to be thorough
  console.log('\n🔍 Scanning all directories for any remaining issues...');
  
  const directories = [
    '/home/runner/workspace/src/commands',
    '/home/runner/workspace/src/handlers',
    '/home/runner/workspace/src/utils'
  ];
  
  for (const dir of directories) {
    if (await fileExists(dir)) {
      console.log(`\nScanning directory: ${dir}`);
      await processDirectory(dir);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`Total files scanned: ${filesScanned}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Direct sock.sendMessage calls fixed: ${sendMessageCallsFixed}`);
  console.log(`Files with errors: ${filesFailed}`);
  
  if (filesModified > 0) {
    console.log('\n✅ Fixes applied successfully!');
    console.log('👉 Restart the bot to apply the changes.');
  } else if (sendMessageCallsFixed === 0 && filesFailed === 0) {
    console.log('\n✅ All files are already using safeSendMessage correctly!');
  } else {
    console.log('\n⚠️ Some files could not be fixed automatically.');
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});