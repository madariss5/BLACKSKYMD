/**
 * Command Verification Tool
 * This script checks if all command modules and files are loaded correctly
 */

// Import necessary modules
const { commandLoader } = require('./src/utils/commandLoader');
const fs = require('fs').promises;
const path = require('path');

// Redirect logger output to prevent verbose logs
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Only log our own messages
console.log = function() {
    if (typeof arguments[0] === 'string' && 
        (arguments[0].includes('====') || 
         arguments[0].includes('Verifying') || 
         arguments[0].includes('Found') || 
         arguments[0].includes('Commands') ||
         arguments[0].includes('✅') ||
         arguments[0].includes('⚠️'))) {
        originalConsoleLog.apply(console, arguments);
    }
};

console.info = function() {};
console.debug = function() {};

// Directories to scan
const COMMANDS_DIR = path.join(__dirname, 'src/commands');
const CONFIG_DIR = path.join(__dirname, 'src/config/commands');

async function verifyCommands() {
    try {
        console.log('\n==== WhatsApp Bot Command Verification Tool ====\n');

        // First, load all commands
        console.log('Loading commands...');
        await commandLoader.loadCommandHandlers();

        // Get all loaded commands
        const loadedCommands = commandLoader.getAllCommands();
        console.log(`Total commands loaded: ${loadedCommands.length}`);

        // Check JS command files
        console.log('\nVerifying command modules:');
        const jsFiles = await fs.readdir(COMMANDS_DIR);
        const commandFiles = jsFiles.filter(file => file.endsWith('.js') && file !== 'index.js');
        console.log(`Found ${commandFiles.length} command module files`);

        // Check JSON config files
        console.log('\nVerifying command configurations:');
        const configFiles = await fs.readdir(CONFIG_DIR);
        const jsonFiles = configFiles.filter(file => file.endsWith('.json'));
        console.log(`Found ${jsonFiles.length} configuration files`);

        // Get all configs
        const configuredCommands = [];
        for (const file of jsonFiles) {
            const configPath = path.join(CONFIG_DIR, file);
            const fileContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(fileContent);

            if (config.commands && Array.isArray(config.commands)) {
                configuredCommands.push(...config.commands.map(cmd => cmd.name));
            }
        }
        console.log(`Found ${configuredCommands.length} configured commands in JSON files`);

        // Get all command code handlers
        const commandHandlers = [];
        for (const file of commandFiles) {
            const modulePath = path.join(COMMANDS_DIR, file);
            // Clear require cache
            delete require.cache[require.resolve(modulePath)];

            // Load the module
            const module = require(modulePath);

            if (module.commands) {
                // New style with commands property
                commandHandlers.push(...Object.keys(module.commands));
            } else if (typeof module === 'object') {
                // Old style object with functions
                commandHandlers.push(...Object.keys(module).filter(key => 
                    typeof module[key] === 'function' && key !== 'init'
                ));
            }
        }
        console.log(`Found ${commandHandlers.length} command handler functions in JS files`);

        // Check for mismatches between configs and handlers
        const missingConfigs = commandHandlers.filter(cmd => !configuredCommands.includes(cmd));
        const missingHandlers = configuredCommands.filter(cmd => !commandHandlers.includes(cmd));

        // Get loaded command names
        const loadedCommandNames = loadedCommands.map(cmd => cmd.config.name);
        const missingLoaded = commandHandlers.filter(cmd => !loadedCommandNames.includes(cmd));

        // Print results
        console.log('\n===== Verification Results =====');

        if (missingConfigs.length > 0) {
            console.log('\nCommands with handlers but missing configs:');
            missingConfigs.forEach(cmd => console.log(`- ${cmd}`));
        } else {
            console.log('\n✅ All command handlers have corresponding configs');
        }

        if (missingHandlers.length > 0) {
            console.log('\nCommands with configs but missing handlers:');
            missingHandlers.forEach(cmd => console.log(`- ${cmd}`));
        } else {
            console.log('\n✅ All configured commands have handlers');
        }

        if (missingLoaded.length > 0) {
            console.log('\nCommands with handlers but not successfully loaded:');
            missingLoaded.forEach(cmd => console.log(`- ${cmd}`));
        } else {
            console.log('\n✅ All command handlers were successfully loaded');
        }

        // Summary
        const totalConfigured = configuredCommands.length;
        const totalHandlers = commandHandlers.length;
        const actuallyLoaded = loadedCommands.length;

        console.log('\n===== Summary =====');
        console.log(`Commands in config files: ${totalConfigured}`);
        console.log(`Command handlers in JS files: ${totalHandlers}`);
        console.log(`Commands actually loaded: ${actuallyLoaded}`);

        if (actuallyLoaded === Math.min(totalConfigured, totalHandlers)) {
            console.log('\n✅ All valid commands are loaded successfully!');
        } else {
            console.log(`\n⚠️ Some commands failed to load. Expected: ${Math.min(totalConfigured, totalHandlers)}, Actual: ${actuallyLoaded}`);
        }

        // List categories and their command counts
        console.log('\n===== Categories =====');
        const categories = {};
        for (const cmd of loadedCommands) {
            const category = cmd.category;
            categories[category] = (categories[category] || 0) + 1;
        }

        for (const [category, count] of Object.entries(categories)) {
            console.log(`${category}: ${count} commands`);
        }

        console.log('\n==== Verification Complete ====\n');

    } catch (err) {
        console.error('Error during verification:', err);
    }
}

// Run the verification
verifyCommands();