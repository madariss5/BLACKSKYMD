/**
 * Test Menu Image Script
 * Tests the menu function with custom image display
 */
const fs = require('fs').promises;
const path = require('path');
const menuCommands = require('./src/commands/menu').commands;
const { languageManager } = require('./src/utils/language');

// Mock SafeMessage function
const safeSendMessage = async (sock, jid, content) => {
    console.log(`Sending message to ${jid}:`);
    if (content.image) {
        const imagePath = content.image.url;
        const imageExists = await fs.access(imagePath).then(() => true).catch(() => false);
        console.log(`Image: ${imagePath} (exists: ${imageExists})`);
    } else if (content.video) {
        const videoPath = content.video.url;
        const videoExists = await fs.access(videoPath).then(() => true).catch(() => false);
        console.log(`GIF: ${videoPath} (exists: ${videoExists})`);
    }
    console.log(`Caption: ${content.caption.substring(0, 50)}...`);
    return true;
};

// Mock SafeSendText function
const safeSendText = async (sock, jid, text) => {
    console.log(`Sending text to ${jid}:`);
    console.log(`Text: ${text.substring(0, 50)}...`);
    return true;
};

// Mock config
const config = {
    bot: {
        prefix: '!',
        language: 'en'
    }
};

// Mock sock
const sock = {
    name: 'MockSocket'
};

// Mock message
const message = {
    key: {
        remoteJid: 'test-user@s.whatsapp.net'
    }
};

// Mock logger
global.logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
};

// Run the test
async function testMenuImage() {
    try {
        console.log('Testing menu with custom image...');
        console.log('=================================');
        
        // Load dependencies into global scope for the menu function
        global.safeSendMessage = safeSendMessage;
        global.safeSendText = safeSendText;
        global.config = config;
        global.fs = fs;
        global.path = path;
        
        // Execute the menu command
        await menuCommands.menu(sock, message, []);
        
        console.log('\nTest completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testMenuImage();