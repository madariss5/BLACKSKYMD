/**
 * Fix SafeSendText Usage in All Command Modules
 * This script ensures proper safeSendText imports across all files
 */
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);

// Main directory to scan
const ROOT_DIR = process.cwd();
const COMMANDS_DIR = path.join(ROOT_DIR, 'src', 'commands');
const HANDLERS_DIR = path.join(ROOT_DIR, 'src', 'handlers');
const UTILS_DIR = path.join(ROOT_DIR, 'src', 'utils');

// Import statement to add if safeSendText is used but not imported
const IMPORT_STATEMENT = `const { safeSendText, safeSendMessage } = require('../utils/jidHelper');`;

// Counter for tracking changes
let filesModified = 0;
let filesFailed = 0;
let filesSkipped = 0;
let filesScanned = 0;

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
 * @returns {boolean} - Whether import already exists
 */
function hasExistingImport(content, importStmt) {
    // Check for various forms of importing safeSendText
    return (
        content.includes(`require('../utils/jidHelper')`) ||
        content.includes(`safeSendText`) && content.includes(`require`) && content.includes(`jidHelper`) ||
        content.includes(`import`) && content.includes(`safeSendText`) && content.includes(`jidHelper`)
    );
}

/**
 * Fix safeSendText usage in a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} - Whether file was modified
 */
async function fixFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        filesScanned++;

        // Skip files that are test files or don't use safeSendText
        if (
            filePath.includes('test') ||
            filePath.includes('.test.js') ||
            filePath.includes('__tests__') ||
            (!content.includes('safeSendText') && !content.includes('sock.sendMessage'))
        ) {
            return false;
        }

        // Check if the file uses safeSendText but doesn't import it
        const usesSafeSendText = content.includes('safeSendText');
        const usesSendMessage = content.includes('sock.sendMessage');
        const hasImport = hasExistingImport(content);

        // Only modify if it uses safeSendText but doesn't import it
        if ((usesSafeSendText || usesSendMessage) && !hasImport) {
            console.log(`🔍 Found usage without import in ${filePath}`);
            
            // Prepare the modified content
            let modified = content;
            
            // Find the right position to add the import
            // We look for other require/import statements and add after the last one
            const lines = content.split('\n');
            let lastRequireIndex = -1;
            
            for (let i = 0; i < lines.length; i++) {
                if (
                    lines[i].includes('require(') || 
                    lines[i].includes('import ') ||
                    lines[i].includes('const') && lines[i].includes('=') && lines[i].includes('require')
                ) {
                    lastRequireIndex = i;
                }
                
                // Stop at the first function or class definition
                if (
                    lines[i].includes('function ') || 
                    lines[i].includes('class ') || 
                    lines[i].includes('module.exports') ||
                    lines[i].includes('exports.')
                ) {
                    break;
                }
            }
            
            // If we found imports, add after the last one
            if (lastRequireIndex >= 0) {
                lines.splice(lastRequireIndex + 1, 0, IMPORT_STATEMENT);
                modified = lines.join('\n');
            } else {
                // If no imports found, add at the top of the file
                modified = IMPORT_STATEMENT + '\n\n' + content;
            }
            
            // Write the modified content back to the file
            await fs.writeFile(filePath, modified, 'utf8');
            console.log(`✅ Fixed safeSendText import in ${filePath}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`❌ Error fixing ${filePath}: ${error.message}`);
        filesFailed++;
        return false;
    }
}

/**
 * Fix specific file where the error was reported
 * @param {string} specificFilePath - Path to fix directly
 */
async function fixSpecificFile(specificFilePath) {
    try {
        if (await fileExists(specificFilePath)) {
            console.log(`🎯 Fixing specific file: ${specificFilePath}`);
            const wasModified = await fixFile(specificFilePath);
            if (wasModified) {
                filesModified++;
                console.log(`✅ Successfully fixed ${specificFilePath}`);
            } else {
                filesSkipped++;
                console.log(`ℹ️ No changes needed for ${specificFilePath}`);
            }
        } else {
            console.error(`❌ File not found: ${specificFilePath}`);
        }
    } catch (error) {
        console.error(`❌ Error fixing specific file: ${error.message}`);
    }
}

/**
 * Recursively scan a directory and fix all JS files
 * @param {string} directory - Directory to scan
 */
async function scanDirectory(directory) {
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            
            if (entry.isDirectory()) {
                // Skip node_modules and other irrelevant directories
                if (
                    entry.name !== 'node_modules' && 
                    entry.name !== '.git' &&
                    !entry.name.startsWith('.')
                ) {
                    await scanDirectory(fullPath);
                }
            } else if (entry.name.endsWith('.js')) {
                const wasModified = await fixFile(fullPath);
                if (wasModified) {
                    filesModified++;
                } else {
                    filesSkipped++;
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error scanning directory ${directory}: ${error.message}`);
    }
}

/**
 * Find and fix media.js file with the speed command error
 */
async function fixMediaSpeedCommand() {
    try {
        const mediaJsPath = path.join(COMMANDS_DIR, 'media.js');
        
        if (await fileExists(mediaJsPath)) {
            console.log('\n🔍 Fixing speed command in media.js file...');
            
            // Read the file content
            const content = await fs.readFile(mediaJsPath, 'utf8');
            
            // Check for the speed command without safeSendText import
            if (content.includes('async speed') && !hasExistingImport(content)) {
                // Add the import statement
                const lines = content.split('\n');
                let lastRequireIndex = -1;
                
                for (let i = 0; i < 20 && i < lines.length; i++) {
                    if (lines[i].includes('require(')) {
                        lastRequireIndex = i;
                    }
                }
                
                if (lastRequireIndex >= 0) {
                    lines.splice(lastRequireIndex + 1, 0, IMPORT_STATEMENT);
                    await fs.writeFile(mediaJsPath, lines.join('\n'), 'utf8');
                    console.log(`✅ Fixed safeSendText import in ${mediaJsPath}`);
                    filesModified++;
                } else {
                    console.log(`❌ Could not find appropriate location for import in ${mediaJsPath}`);
                }
                
                // Now check the speed function itself
                const speedPattern = /async\s+speed\s*\([^)]*\)\s*{([^}]*)}/gs;
                const speedMatch = speedPattern.exec(content);
                
                if (speedMatch && speedMatch[1]) {
                    const speedFunction = speedMatch[0];
                    
                    // Check if it's using safeSendText directly without checking for its existence
                    if (speedFunction.includes('safeSendText(') && !speedFunction.includes('const { safeSendText }')) {
                        console.log('🔍 Found direct usage of safeSendText in speed function');
                        // The import should be fixed by now, so no need to modify the function body
                    }
                }
            } else {
                console.log(`ℹ️ No changes needed for ${mediaJsPath}`);
                filesSkipped++;
            }
        } else {
            console.error(`❌ media.js file not found at ${mediaJsPath}`);
        }
    } catch (error) {
        console.error(`❌ Error fixing media.js: ${error.message}`);
        filesFailed++;
    }
}

/**
 * Find all JS files that use safeSendText
 */
async function findAllUsages() {
    try {
        console.log('\n🔍 Finding all files that use safeSendText...');
        
        // Use grep to find all occurrences
        const { stdout } = await execPromise(`grep -r "safeSendText" --include="*.js" ${ROOT_DIR}/src`);
        
        console.log('\nFiles using safeSendText:');
        console.log(stdout);
        
        return stdout.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.split(':')[0]);
    } catch (error) {
        console.error(`❌ Error finding safeSendText usages: ${error.message}`);
        return [];
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🛠 Starting safeSendText fix script...');
    
    // First fix the specific file with the reported error
    const mediaJsPath = path.join(COMMANDS_DIR, 'media.js');
    await fixSpecificFile(mediaJsPath);
    
    // Then scan all directories
    console.log('\n🔍 Scanning all command modules for safeSendText...');
    await scanDirectory(COMMANDS_DIR);
    
    console.log('\n🔍 Scanning handlers directory...');
    await scanDirectory(HANDLERS_DIR);
    
    // Find and list all files using safeSendText
    const usageFiles = await findAllUsages();
    
    // Fix media.js speed command specifically
    await fixMediaSpeedCommand();
    
    // Print summary
    console.log('\n📊 Summary:');
    console.log(`Total files scanned: ${filesScanned}`);
    console.log(`Files modified: ${filesModified}`);
    console.log(`Files skipped: ${filesSkipped}`);
    console.log(`Files failed: ${filesFailed}`);
    
    if (filesModified > 0) {
        console.log('\n✅ Fixes applied! The "safeSendText is not defined" error should be resolved.');
        console.log('👉 Restart the bot to apply the changes.');
    } else {
        console.log('\nℹ️ No changes were needed or applied.');
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});