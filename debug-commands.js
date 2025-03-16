/**
 * Debug Command Execution for WhatsApp Bot
 * This script helps debug issues with the command system
 */

// Force debug mode
process.env.DEBUG_MODE = 'true';

// Import required modules
const fs = require('fs');
const path = require('path');

// Function to get command files
function getCommandFiles(directoryPath) {
    try {
        // Check if directory exists
        if (!fs.existsSync(directoryPath)) {
            console.error(`[ERROR] Directory does not exist: ${directoryPath}`);
            return [];
        }
        
        console.log(`[INFO] Checking directory: ${directoryPath}`);
        
        // Get all files in directory
        const files = fs.readdirSync(directoryPath).filter(file => 
            file.endsWith('.js') && !file.startsWith('_') && file !== 'index.js'
        );
        
        console.log(`[INFO] Found ${files.length} command files in ${directoryPath}`);
        return files.map(file => path.join(directoryPath, file));
    } catch (err) {
        console.error(`[ERROR] Error reading directory ${directoryPath}: ${err.message}`);
        return [];
    }
}

// Function to test load a command module
function testLoadCommandModule(filePath) {
    try {
        console.log(`[INFO] Testing load of command module: ${filePath}`);
        
        // Try to require the module
        const module = require(filePath);
        
        // Check if it has expected properties
        if (!module) {
            console.error(`[ERROR] Module is empty: ${filePath}`);
            return false;
        }
        
        if (!module.commands) {
            console.error(`[ERROR] Module has no commands property: ${filePath}`);
            return false;
        }
        
        // Check command structure
        const commandCount = Object.keys(module.commands).length;
        console.log(`[INFO] Module has ${commandCount} commands: ${filePath}`);
        
        // Test a few commands at random
        const commandNames = Object.keys(module.commands);
        for (let i = 0; i < Math.min(3, commandNames.length); i++) {
            const commandName = commandNames[i];
            const command = module.commands[commandName];
            
            if (typeof command !== 'function') {
                console.error(`[ERROR] Command is not a function: ${commandName} in ${filePath}`);
                return false;
            }
            
            console.log(`[INFO] Command looks valid: ${commandName} in ${filePath}`);
        }
        
        return true;
    } catch (err) {
        console.error(`[ERROR] Failed to load module ${filePath}: ${err.message}`);
        return false;
    }
}

// Main function
async function main() {
    console.log('===== WHATSAPP BOT COMMAND DEBUG =====');
    
    // Get all command files
    const commandsDirs = [
        path.join(__dirname, 'commands'),
        path.join(__dirname, 'src', 'commands')
    ];
    
    let totalFiles = 0;
    let validFiles = 0;
    
    // Test load each directory
    for (const dir of commandsDirs) {
        const files = getCommandFiles(dir);
        totalFiles += files.length;
        
        for (const file of files) {
            const valid = testLoadCommandModule(file);
            if (valid) validFiles++;
        }
    }
    
    console.log('\n===== COMMAND LOAD SUMMARY =====');
    console.log(`Total command files: ${totalFiles}`);
    console.log(`Valid command files: ${validFiles}`);
    console.log(`Success rate: ${totalFiles > 0 ? Math.round((validFiles / totalFiles) * 100) : 0}%`);
    
    // Check for message handler
    console.log('\n===== MESSAGE HANDLER CHECK =====');
    try {
        const handlerPath = path.join(__dirname, 'src', 'simplified-message-handler.js');
        if (fs.existsSync(handlerPath)) {
            console.log(`[INFO] Message handler exists: ${handlerPath}`);
            
            try {
                const handler = require(handlerPath);
                console.log(`[INFO] Message handler loaded successfully`);
                
                if (typeof handler.init === 'function') {
                    console.log(`[INFO] Message handler has valid init function`);
                } else {
                    console.error(`[ERROR] Message handler is missing init function`);
                }
            } catch (err) {
                console.error(`[ERROR] Failed to load message handler: ${err.message}`);
            }
        } else {
            console.error(`[ERROR] Message handler file not found`);
        }
    } catch (err) {
        console.error(`[ERROR] Error checking message handler: ${err.message}`);
    }
    
    console.log('\n===== COMMAND SYSTEM DEBUG COMPLETE =====');
}

// Run the main function
main().catch(err => {
    console.error('Fatal error:', err);
});