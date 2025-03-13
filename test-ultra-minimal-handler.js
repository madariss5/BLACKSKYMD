/**
 * Test for Ultra Minimal Handler
 * Tests the functionality of the ultra-minimal handler without requiring a WhatsApp connection
 */

// Import the ultra-minimal handler
const handler = require('./src/handlers/ultra-minimal-handler');

// Create a mock socket object
const mockSock = {
    sendMessage: async (jid, content) => {
        console.log(`[MOCK] Message sent to ${jid}:`);
        console.log(JSON.stringify(content, null, 2));
        return {
            status: 1,
            message: 'Mock message sent'
        };
    }
};

// Create a mock message
const createMockMessage = (text, jid = '123456789@s.whatsapp.net') => {
    return {
        key: {
            remoteJid: jid,
            fromMe: false,
            id: 'mock-message-id'
        },
        message: {
            conversation: text
        }
    };
};

// Test all commands
async function testAllCommands() {
    console.log('Testing Ultra Minimal Handler Commands...\n');
    
    // Initialize the handler
    await handler.init();
    console.log(`Handler initialized with ${handler.commands.size} commands\n`);
    
    // Test each command
    const commands = [
        '!ping',
        '!help',
        '!status',
        '!about'
    ];
    
    for (const command of commands) {
        console.log(`\n=== Testing command: ${command} ===`);
        const mockMessage = createMockMessage(command);
        try {
            await handler.messageHandler(mockSock, mockMessage);
            console.log(`✅ Command ${command} executed successfully`);
        } catch (err) {
            console.error(`❌ Command ${command} failed:`, err);
        }
    }
    
    console.log('\nAll command tests completed');
}

// Run the tests
testAllCommands().catch(console.error);