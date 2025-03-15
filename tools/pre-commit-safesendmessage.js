#!/usr/bin/env node
/**
 * Pre-commit hook to validate safeSendMessage usage
 * This script checks that any modified JS files properly use safeSendMessage
 * and don't contain direct sock.sendMessage calls
 * 
 * Usage:
 * 1. Make it executable: chmod +x tools/pre-commit-safesendmessage.js
 * 2. Link it as a pre-commit hook: ln -s ../../tools/pre-commit-safesendmessage.js .git/hooks/pre-commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get staged files from git
function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only --diff-filter=ACMR').toString().trim();
    return result.split('\n').filter(file => file.endsWith('.js'));
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    return [];
  }
}

// Check if a file contains direct sock.sendMessage calls
function checkFile(filePath) {
  try {
    // Skip implementation files
    if (filePath.endsWith('jidHelper.js')) {
      return { valid: true };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for safeSendMessage import
    const hasJidHelperImport = content.includes('jidHelper');
    const usesSafeSend = content.includes('safeSendMessage') || 
                         content.includes('safeSendText') || 
                         content.includes('safeSendImage');
    
    // Direct sock.sendMessage call detection
    const directCallRegex = /sock\.sendMessage\s*\(\s*[^,]+,\s*\{/g;
    const directCalls = content.match(directCallRegex) || [];
    
    // Validation check is allowed
    const isValidationCheck = content.includes('typeof sock.sendMessage === \'function\'');
    
    // Problems
    const problems = [];
    
    if (usesSafeSend && !hasJidHelperImport) {
      problems.push('Uses safeSendMessage functions but missing jidHelper import');
    }
    
    if (directCalls.length > 0 && !isValidationCheck) {
      problems.push(`Contains ${directCalls.length} direct sock.sendMessage call(s)`);
    }
    
    return {
      valid: problems.length === 0,
      problems
    };
  } catch (error) {
    return {
      valid: false,
      problems: [`Error analyzing file: ${error.message}`]
    };
  }
}

// Main function
function main() {
  console.log('🔍 Checking safeSendMessage usage in staged files...');
  
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('✅ No JS files staged for commit.');
    process.exit(0);
  }
  
  let hasErrors = false;
  
  stagedFiles.forEach(file => {
    console.log(`Checking ${file}...`);
    const result = checkFile(file);
    
    if (!result.valid) {
      hasErrors = true;
      console.error(`❌ ${file}:`);
      result.problems.forEach(problem => {
        console.error(`   - ${problem}`);
      });
      console.error('');
    }
  });
  
  if (hasErrors) {
    console.error('\n❌ Your commit contains files with unsafe message sending!');
    console.error('Please fix the issues before committing. You can:');
    console.error('1. Use safeSendMessage/safeSendText instead of direct sock.sendMessage calls');
    console.error('2. Import jidHelper: const { safeSendMessage } = require("../utils/jidHelper");');
    console.error('\nTo bypass this check, use git commit with --no-verify');
    process.exit(1);
  } else {
    console.log('✅ All staged files have proper safeSendMessage usage.');
  }
}

// Run the script
main();