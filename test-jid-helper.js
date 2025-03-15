/**
 * JID Helper Functions Test Utility
 * 
 * Tests different JID validation and message sending scenarios
 * Helps identify potential issues with the jidHelper utility
 */

const { 
    isJidGroup, 
    isJidUser, 
    normalizeJid, 
    ensureJidString, 
    extractUserIdFromJid,
    safeSendMessage, 
    safeSendText,
    safeSendImage,
    safeSendSticker,
    safeSendAnimatedGif
} = require('./src/utils/jidHelper');

const logger = require('./src/utils/logger');
const path = require('path');
const fs = require('fs');

// Sample test data
const testJids = [
    '1234567890@s.whatsapp.net',       // Valid user JID
    '1234567890@c.us',                 // Old format user JID
    '1234567890-1234567890@g.us',      // Valid group JID
    '1234567890',                      // Invalid JID (no domain)
    null,                              // Null JID
    undefined,                         // Undefined JID
    {},                                // Empty object
    { key: { remoteJid: '1234567890@s.whatsapp.net' } }, // Message-like object
    { remoteJid: '1234567890@s.whatsapp.net' }          // Partial message-like object
];

// Mock WhatsApp socket for testing
const mockSock = {
    sendMessage: async (jid, content) => {
        logger.info(`Mock: sendMessage called with JID: ${jid}`);
        logger.info(`Mock: Content type: ${Object.keys(content).join(', ')}`);
        return { status: 'success', messageID: `mock-msg-${Date.now()}` };
    }
};

// Test JID validation functions
function testJidValidation() {
    logger.info('===== Testing JID Validation Functions =====');
    
    for (const jid of testJids) {
        logger.info(`\nTesting JID: ${JSON.stringify(jid)}`);
        logger.info(`isJidGroup: ${isJidGroup(jid)}`);
        logger.info(`isJidUser: ${isJidUser(jid)}`);
        logger.info(`normalizeJid: ${normalizeJid(jid)}`);
        logger.info(`ensureJidString: ${ensureJidString(jid)}`);
        logger.info(`extractUserIdFromJid: ${extractUserIdFromJid(jid)}`);
    }
}

// Test message sending functions
async function testMessageSending() {
    logger.info('\n===== Testing Message Sending Functions =====');
    
    for (const jid of testJids) {
        if (!jid) continue; // Skip null/undefined for clarity
        
        logger.info(`\nTesting message sending to JID: ${JSON.stringify(jid)}`);
        
        // Test text message
        logger.info('Testing safeSendText...');
        await safeSendText(mockSock, jid, 'Test message');
        
        // Test image message
        logger.info('Testing safeSendImage...');
        await safeSendImage(mockSock, jid, 'https://example.com/image.jpg', 'Test image caption');
    }
}

// Test GIF sending function
async function testGifSending() {
    logger.info('\n===== Testing GIF Sending Function =====');
    
    // Find sample GIF
    const gifPath = path.join(__dirname, 'animated_gifs', 'smile.gif');
    if (!fs.existsSync(gifPath)) {
        logger.error(`Test GIF file not found at ${gifPath}`);
        return;
    }
    
    const validJid = '1234567890@s.whatsapp.net';
    logger.info(`Testing safeSendAnimatedGif with valid JID: ${validJid}`);
    await safeSendAnimatedGif(mockSock, validJid, gifPath, 'Test GIF caption');
    
    // Test with message-like object
    const messageObj = { key: { remoteJid: '1234567890@s.whatsapp.net' } };
    logger.info(`Testing safeSendAnimatedGif with message object: ${JSON.stringify(messageObj)}`);
    await safeSendAnimatedGif(mockSock, messageObj, gifPath, 'Test GIF from message object');
}

// Run all tests
async function runTests() {
    logger.info('Starting JID Helper tests...');
    
    testJidValidation();
    await testMessageSending();
    await testGifSending();
    
    logger.info('\n✅ JID Helper tests completed');
}

// Start the tests
runTests()
    .then(() => {
        logger.info('All tests completed successfully');
    })
    .catch(err => {
        logger.error('Error during tests:', err);
    });