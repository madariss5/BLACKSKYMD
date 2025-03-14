/**
 * Command Testing Utility for WhatsApp Bot
 * Tests commands in each category to verify functionality
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./src/utils/logger');

async function getAllCommandFiles() {
    const commandsDir = path.join(__dirname, 'src', 'commands');
    
    // Function to recursively get all files
    async function getAllFiles(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async entry => {
            const fullPath = path.join(dir, entry.name);
            return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
        }));
        return files.flat();
    }
    
    // Get all JS files including those in subdirectories
    const commandFiles = await getAllFiles(commandsDir);
    
    // Only get JS files that aren't index.js
    return commandFiles.filter(file => 
        file.endsWith('.js') && 
        !file.endsWith('index.js')
    );
}

async function testCommandFile(filePath) {
    const relativePath = path.relative(__dirname, filePath);
    console.log(`\n🔍 Testing ${relativePath}`);
    
    try {
        // Import the command module
        const commandModule = require(filePath);
        
        // Determine module type
        const hasCategory = !!commandModule.category;
        const hasCommands = !!commandModule.commands;
        const hasInit = typeof commandModule.init === 'function';
        
        console.log(`📋 Module type: ${hasCategory ? 'Categorized' : 'Direct exports'}`);
        console.log(`📋 Has init function: ${hasInit ? 'Yes' : 'No'}`);
        
        // Get commands from the module
        const commands = hasCommands ? commandModule.commands : commandModule;
        
        // Count and list commands
        const commandList = Object.keys(commands).filter(key => 
            typeof commands[key] === 'function' && key !== 'init'
        );
        
        console.log(`📋 Commands found: ${commandList.length}`);
        
        // Check each command for proper structure
        for (const cmdName of commandList) {
            const command = commands[cmdName];
            
            // Check if the command has the expected signature
            const isValid = command.length >= 2; // Should have at least sock and message params
            
            console.log(`  - ${cmdName}: ${isValid ? '✅ Valid' : '❌ Invalid signature'}`);
        }
        
        // Try to initialize the module if it has an init function
        if (hasInit) {
            try {
                const initResult = await commandModule.init();
                console.log(`📋 Init result: ${initResult ? '✅ Success' : '❌ Failed'}`);
            } catch (error) {
                console.error(`❌ Init error: ${error.message}`);
            }
        }
        
        return {
            path: relativePath,
            commandCount: commandList.length,
            hasInit,
            success: true
        };
    } catch (error) {
        console.error(`❌ Error loading module: ${error.message}`);
        return {
            path: relativePath,
            error: error.message,
            success: false
        };
    }
}

async function testAllCommands() {
    console.log('🚀 Starting command tests...');
    
    // Get all command files
    const commandFiles = await getAllCommandFiles();
    console.log(`📋 Found ${commandFiles.length} command files to test\n`);
    
    // Test results
    const results = {
        total: commandFiles.length,
        success: 0,
        failed: 0,
        commands: 0,
        byCategory: {}
    };
    
    // Test each file
    for (const file of commandFiles) {
        const result = await testCommandFile(file);
        
        if (result.success) {
            results.success++;
            results.commands += result.commandCount;
            
            // Group by directory/category
            const category = path.basename(path.dirname(file)) === 'commands' 
                ? path.basename(file, '.js') 
                : path.basename(path.dirname(file));
            
            if (!results.byCategory[category]) {
                results.byCategory[category] = {
                    files: 0,
                    commands: 0
                };
            }
            
            results.byCategory[category].files++;
            results.byCategory[category].commands += result.commandCount;
        } else {
            results.failed++;
        }
    }
    
    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`Total files: ${results.total}`);
    console.log(`Successful: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total commands: ${results.commands}`);
    
    console.log('\n📊 By Category:');
    Object.entries(results.byCategory).forEach(([category, data]) => {
        console.log(`${category}: ${data.files} files, ${data.commands} commands`);
    });
}

// Run tests
testAllCommands().catch(error => {
    console.error('Error running tests:', error);
});