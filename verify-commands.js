/**
 * Command Verification Script
 * This script checks if all command modules can be loaded properly
 * and prints a summary of available commands.
 */

const { testLoadAllModules } = require('./src/utils/commandVerification');
const fs = require('fs');
const path = require('path');

/**
 * Format the output with colors for better readability
 * @param {string} text - Text to format
 * @param {string} color - ANSI color code
 * @returns {string} - Formatted text
 */
function colorize(text, color) {
    const colors = {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    };
    
    return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Format file size in a human-readable way
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get a visual indicator based on a value
 * @param {boolean} value - The value to check
 * @returns {string} - Visual indicator
 */
function getIndicator(value) {
    return value ? colorize('✓', 'green') : colorize('✗', 'red');
}

/**
 * Print a summary table of the test results
 * @param {Object} results - Test results
 */
function printSummaryTable(results) {
    console.log('\n📊 COMMAND MODULE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total files found: ${colorize(results.totalFiles, 'cyan')}`);
    console.log(`Successfully loaded: ${colorize(results.successfulLoads, 'green')} / ${results.totalFiles}`);
    console.log(`Failed to load: ${colorize(results.failedLoads, 'red')} / ${results.totalFiles}`);
    console.log(`Success rate: ${colorize(Math.round((results.successfulLoads / results.totalFiles) * 100) + '%', 
        results.successfulLoads === results.totalFiles ? 'green' : 'yellow')}`);
    console.log('='.repeat(80));
    
    // Print details table
    console.log('\n📋 DETAILED RESULTS');
    console.log('='.repeat(110));
    console.log(
        colorize('MODULE NAME'.padEnd(30), 'cyan') +
        colorize('LOADED'.padEnd(10), 'cyan') +
        colorize('COMMANDS'.padEnd(12), 'cyan') +
        colorize('HAS INIT'.padEnd(12), 'cyan') +
        colorize('SIZE'.padEnd(10), 'cyan') +
        colorize('STATUS'.padEnd(20), 'cyan')
    );
    console.log('='.repeat(110));
    
    // Sort by load status (failed first)
    const sortedDetails = [...results.details].sort((a, b) => {
        if (a.loaded !== b.loaded) return a.loaded ? 1 : -1;
        return path.basename(a.path).localeCompare(path.basename(b.path));
    });
    
    for (const detail of sortedDetails) {
        const fileName = path.basename(detail.path);
        let fileSize = '';
        try {
            const stats = fs.statSync(detail.path);
            fileSize = formatFileSize(stats.size);
        } catch (err) {
            fileSize = 'N/A';
        }
        
        console.log(
            fileName.padEnd(30) +
            getIndicator(detail.loaded).padEnd(10) +
            (detail.loaded ? `${detail.commandCount}`.padEnd(12) : 'N/A'.padEnd(12)) +
            (detail.loaded ? getIndicator(detail.hasInit).padEnd(12) : 'N/A'.padEnd(12)) +
            fileSize.padEnd(10) +
            (detail.loaded 
                ? colorize('OK', 'green').padEnd(20) 
                : colorize(detail.error.substring(0, 17) + '...', 'red').padEnd(20))
        );
    }
    console.log('='.repeat(110));
    
    // Print recommendations
    if (results.failedLoads > 0) {
        console.log(colorize('\n⚠️ RECOMMENDATIONS', 'yellow'));
        console.log('='.repeat(80));
        console.log('The following modules failed to load:');
        const failedModules = results.details.filter(d => !d.loaded);
        for (const module of failedModules) {
            console.log(`- ${colorize(path.basename(module.path), 'red')}: ${module.error}`);
        }
        console.log('\nPossible solutions:');
        console.log('1. Check for syntax errors in these files');
        console.log('2. Make sure all required dependencies are installed');
        console.log('3. Verify the module format matches the expected structure (commands object and init function)');
        console.log('4. Check for circular dependencies');
    } else {
        console.log(colorize('\n✅ All command modules loaded successfully!', 'green'));
    }
}

/**
 * Print commands by category
 * @param {Object} results - Test results
 */
function printCommandsByCategory(results) {
    const categories = {};
    const successfulModules = results.details.filter(d => d.loaded);
    
    for (const module of successfulModules) {
        try {
            const moduleObj = require(module.path);
            const category = moduleObj.category || 'uncategorized';
            
            if (!categories[category]) {
                categories[category] = [];
            }
            
            if (moduleObj.commands) {
                const commandNames = Object.keys(moduleObj.commands);
                categories[category].push(...commandNames);
            }
        } catch (err) {
            // Skip if can't load
        }
    }
    
    console.log('\n📑 AVAILABLE COMMANDS BY CATEGORY');
    console.log('='.repeat(80));
    
    for (const [category, commands] of Object.entries(categories)) {
        console.log(colorize(`\n[${category.toUpperCase()}]`, 'magenta') + 
            colorize(` (${commands.length} commands)`, 'cyan'));
        console.log('-'.repeat(80));
        
        const sortedCommands = [...commands].sort();
        const rows = [];
        let currentRow = [];
        
        for (const cmd of sortedCommands) {
            currentRow.push(cmd);
            if (currentRow.length === 4) {
                rows.push([...currentRow]);
                currentRow = [];
            }
        }
        
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }
        
        for (const row of rows) {
            console.log(row.map(cmd => `!${cmd}`.padEnd(20)).join(''));
        }
    }
}

/**
 * Main function to run the verification
 */
async function main() {
    console.log(colorize('\n🚀 BLACKSKY-MD COMMAND VERIFICATION', 'cyan'));
    console.log('='.repeat(80));
    console.log('Testing all command modules...');
    
    const results = await testLoadAllModules();
    printSummaryTable(results);
    
    if (results.successfulLoads > 0) {
        printCommandsByCategory(results);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(colorize('Verification completed!', 'green'));
}

main().catch(err => {
    console.error('Error during verification:', err);
    process.exit(1);
});