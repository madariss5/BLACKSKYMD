/**
 * NSFW Commands Test Utility
 * 
 * This script tests individual NSFW commands to ensure they
 * work correctly with the fixed JID handling.
 */

const nsfwModule = require('./src/commands/nsfw');
const logger = require('./src/utils/logger');

// Mock WhatsApp socket with logging for testing
const mockSock = {
    sendMessage: async (jid, content) => {
        logger.info(`Mock: sendMessage called with JID: ${jid}`);
        logger.info(`Mock: Content type: ${Object.keys(content).join(', ')}`);
        return { status: 'success', messageID: `mock-msg-${Date.now()}` };
    },
    sendPresenceUpdate: async () => {}
};

// Create mock message object for a user
function createUserMessage(command) {
    return {
        key: {
            remoteJid: 'user123456@s.whatsapp.net',
            fromMe: false,
            id: `mock-${Date.now()}`
        },
        message: {
            conversation: `!${command}`
        }
    };
}

// Create mock message object for a group
function createGroupMessage(command) {
    return {
        key: {
            remoteJid: 'group123456@g.us',
            fromMe: false,
            id: `mock-${Date.now()}`
        },
        message: {
            conversation: `!${command}`
        }
    };
}

// Check if a command exists
function commandExists(commandName) {
    return typeof nsfwModule[commandName] === 'function';
}

// Test a specific command
async function testCommand(commandName, args = [], isGroup = false) {
    logger.info(`\n======== Testing NSFW command: ${commandName} ========`);
    
    try {
        if (!commandExists(commandName)) {
            logger.error(`Command '${commandName}' does not exist in NSFW module`);
            return false;
        }
        
        const message = isGroup ? createGroupMessage(commandName) : createUserMessage(commandName);
        
        logger.info(`Executing command with message: ${JSON.stringify(message.key)}`);
        await nsfwModule[commandName](mockSock, message, args);
        
        logger.info(`✅ Command '${commandName}' executed without errors`);
        return true;
    } catch (error) {
        logger.error(`❌ Error executing '${commandName}':`, error);
        return false;
    }
}

// Test all NSFW commands
async function testAllCommands() {
    // First test configuration commands
    await testCommand('toggleNSFW', ['on'], true);
    await testCommand('nsfwSettings', ['threshold', '80'], true);
    await testCommand('nsfwStats');
    await testCommand('verify', ['25']);
    await testCommand('nsfwHelp');
    await testCommand('isNSFW', ['https://example.com/image.jpg']);
    
    // Then test NSFW image commands
    await testCommand('waifu');
    await testCommand('neko');
    
    // Add more content-related commands as needed
    
    logger.info('\n✅ NSFW commands testing completed');
}

// Initialize the NSFW module if needed
async function init() {
    if (typeof nsfwModule.init === 'function') {
        logger.info('Initializing NSFW module...');
        await nsfwModule.init();
    }
}

// Main function
async function main() {
    logger.info('Starting NSFW commands tests...');
    
    await init();
    await testAllCommands();
    
    logger.info('All tests completed');
}

// Run the tests
main()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        logger.error('Fatal error during testing:', err);
        process.exit(1);
    });