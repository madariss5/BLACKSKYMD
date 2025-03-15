/**
 * Validate SafeSendMessage Usage
 * This script analyzes all command modules to ensure they properly import and use the safe messaging functions
 */

const fs = require('fs').promises;
const path = require('path');

// Statistics
let filesAnalyzed = 0;
let filesWithProperImports = 0;
let filesWithoutImports = 0;
let filesWithoutUsage = 0;
let potentialIssues = 0;

// Required utility functions
const getMissingImports = (content) => {
  const hasSafeSendMessage = content.includes('safeSendMessage');
  const hasSafeSendText = content.includes('safeSendText');
  const hasSafeSendImage = content.includes('safeSendImage');
  const hasSafeSendAudio = content.includes('safeSendAudio');
  const hasSafeSendVideo = content.includes('safeSendVideo');
  const hasSafeSendDocument = content.includes('safeSendDocument');
  const hasSafeSendButtons = content.includes('safeSendButtons');
  const hasSafeSendLocation = content.includes('safeSendLocation');
  const hasSafeSendContact = content.includes('safeSendContact');
  const hasSafeSendSticker = content.includes('safeSendSticker');
  const hasSafeSendAnimatedGif = content.includes('safeSendAnimatedGif');
  const hasJidHelperImport = content.includes('jidHelper');
  
  const missing = [];
  
  // If there's any usage of safe functions but no import
  if ((hasSafeSendMessage || 
       hasSafeSendText || 
       hasSafeSendImage ||
       hasSafeSendAudio ||
       hasSafeSendVideo ||
       hasSafeSendDocument ||
       hasSafeSendButtons ||
       hasSafeSendLocation ||
       hasSafeSendContact ||
       hasSafeSendSticker ||
       hasSafeSendAnimatedGif) && !hasJidHelperImport) {
    missing.push('jidHelper import missing');
  }
  
  // If sending messages but not using safe functions - only count actual calls
  const directCallRegex = /sock\.sendMessage\s*\(\s*[^,]+,\s*\{/g;
  const directCalls = content.match(directCallRegex) || [];
  
  // Don't flag if it's just a validation check
  const isValidationCheck = content.includes('typeof sock.sendMessage === \'function\'');
  
  if (directCalls.length > 0 && !isValidationCheck) {
    missing.push('uses direct sock.sendMessage');
  }
  
  return missing;
};

/**
 * Analyze a command file
 * @param {string} filePath - Path to file
 */
async function analyzeFile(filePath) {
  try {
    if (filePath.includes('node_modules') || 
        filePath.includes('.git') ||
        filePath.endsWith('.json') ||
        filePath.endsWith('.md') ||
        filePath.includes('test') ||
        filePath.includes('fix-')) {
      return;
    }
    
    // Skip the implementation file itself
    if (filePath.endsWith('jidHelper.js')) {
      return;
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    filesAnalyzed++;
    
    // Check if this file handles message sending
    const handlesSending = content.includes('sendMessage') || 
                           content.includes('safeSendMessage') ||
                           content.includes('safeSendText') ||
                           content.includes('safeSendImage') ||
                           content.includes('safeSendAudio') ||
                           content.includes('safeSendVideo') ||
                           content.includes('safeSendDocument') ||
                           content.includes('safeSendButtons') ||
                           content.includes('safeSendLocation') ||
                           content.includes('safeSendContact') ||
                           content.includes('safeSendSticker') ||
                           content.includes('safeSendAnimatedGif');
    
    if (!handlesSending) {
      // File doesn't send messages, so nothing to validate
      return;
    }
    
    // Check for proper imports
    const hasImport = content.includes('jidHelper');
    
    if (hasImport) {
      filesWithProperImports++;
    } else {
      filesWithoutImports++;
      console.log(`⚠️ Missing import in: ${filePath}`);
    }
    
    // Check for usage
    const usesSafeSend = content.includes('safeSendMessage') || 
                          content.includes('safeSendText') ||
                          content.includes('safeSendImage') ||
                          content.includes('safeSendAudio') ||
                          content.includes('safeSendVideo') ||
                          content.includes('safeSendDocument') ||
                          content.includes('safeSendButtons') ||
                          content.includes('safeSendLocation') ||
                          content.includes('safeSendContact') ||
                          content.includes('safeSendSticker') ||
                          content.includes('safeSendAnimatedGif');
    
    // Check for actual direct calls to sock.sendMessage (not just type checking)
    const directCallRegex = /sock\.sendMessage\s*\(\s*[^,]+,\s*\{/g;
    const directCalls = content.match(directCallRegex) || [];
    
    // Skip validation check in errorHandler.js since it's correctly checking sock.sendMessage existence
    const isValidation = content.includes('typeof sock.sendMessage === \'function\'') && 
                         !directCalls.length;
                        
    if (!usesSafeSend && directCalls.length > 0 && !isValidation) {
      filesWithoutUsage++;
      console.log(`❌ Uses direct sock.sendMessage without safe wrapper: ${filePath}`);
    }
    
    // Find any missing imports or suspicious patterns
    const issues = getMissingImports(content);
    
    // Skip warning about direct sock.sendMessage if it's just for type checking
    if (issues.includes('uses direct sock.sendMessage') && isValidation) {
      const idx = issues.indexOf('uses direct sock.sendMessage');
      if (idx !== -1) {
        issues.splice(idx, 1);
      }
    }
    
    if (issues.length > 0) {
      potentialIssues++;
      console.log(`🔍 Potential issue in ${filePath}:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  } catch (error) {
    console.error(`Error analyzing ${filePath}: ${error.message}`);
  }
}

/**
 * Recursively process files in a directory
 * @param {string} dir - Directory to process 
 */
async function processDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, etc.
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        
        await processDirectory(fullPath);
      } else if (entry.name.endsWith('.js')) {
        await analyzeFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Validating safeSendMessage usage across all modules...');
  
  const directories = [
    '/home/runner/workspace/src/commands',
    '/home/runner/workspace/src/handlers',
    '/home/runner/workspace/src/utils'
  ];
  
  for (const dir of directories) {
    console.log(`\nScanning directory: ${dir}`);
    await processDirectory(dir);
  }
  
  console.log('\n📊 Validation Summary:');
  console.log(`Total files analyzed: ${filesAnalyzed}`);
  console.log(`Files with proper imports: ${filesWithProperImports}`);
  console.log(`Files missing imports: ${filesWithoutImports}`);
  console.log(`Files using direct sendMessage: ${filesWithoutUsage}`);
  console.log(`Files with potential issues: ${potentialIssues}`);
  
  if (filesWithoutImports === 0 && filesWithoutUsage === 0 && potentialIssues === 0) {
    console.log('\n✅ All modules are correctly using safeSendMessage functions!');
  } else {
    console.log('\n⚠️ Some files may need attention. See the issues reported above.');
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
});