/**
 * Test Script for Enhanced Error Recovery System
 * This script tests the advanced error handling and message recovery capabilities
 */

const { 
  categorizeError, 
  getUserFriendlyErrorMessage,
  sendEnhancedErrorMessage,
  retryMessageSend
} = require('./src/utils/errorHandler');

const { 
  safeSendText,
  safeSendButtons
} = require('./src/utils/jidHelper');

const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

// Simulate different error types
function createTestErrors() {
  const errors = {
    connection: new Error('Connection timeout while trying to reach WhatsApp servers'),
    authentication: new Error('Authentication failed: Unauthorized access to this feature'),
    rate_limit: new Error('Too many requests, please slow down (429)'),
    media: new Error('The media file is too large to process'),
    validation: new Error('Invalid format for the provided phone number'),
    jid: new Error('The JID format is incorrect: missing @s.whatsapp.net suffix'),
    unknown: new Error('Something unexpected happened')
  };
  
  // Add a custom user error
  const userError = new Error('Please provide a valid URL');
  userError.isUserError = true;
  errors.user = userError;
  
  return errors;
}

// Test error categorization
function testErrorCategorization() {
  console.log('\n🔍 Testing Error Categorization');
  console.log('------------------------------');
  
  const errors = createTestErrors();
  
  for (const [type, error] of Object.entries(errors)) {
    const category = categorizeError(error);
    console.log(`Error type: ${type.padEnd(15)} → Category: ${category.padEnd(15)} → Message: ${error.message}`);
  }
}

// Test user-friendly messages
function testUserFriendlyMessages() {
  console.log('\n🗣️ Testing User-Friendly Messages');
  console.log('---------------------------------');
  
  const errors = createTestErrors();
  const commandName = 'testCommand';
  
  for (const [type, error] of Object.entries(errors)) {
    const category = categorizeError(error);
    const message = getUserFriendlyErrorMessage(category, commandName);
    console.log(`Error type: ${type.padEnd(15)} → Message: ${message}`);
  }
}

// Mock WhatsApp socket for testing
function createMockSocket() {
  return {
    sendMessage: async (jid, content) => {
      console.log(`📤 Mock message sent to ${jid}:`);
      console.log(JSON.stringify(content, null, 2));
      return { status: 1 }; // Simulate successful sending
    },
    user: {
      id: '1234567890@s.whatsapp.net'
    }
  };
}

// Test the retryMessageSend function with simulated failures
async function testRetryMessageSend() {
  console.log('\n🔄 Testing Retry Message Sending');
  console.log('-------------------------------');
  
  const mockSock = createMockSocket();
  const jid = '1234567890@s.whatsapp.net';
  
  // Override safeSendText to simulate failures then success
  let attemptCount = 0;
  const originalSafeSendText = safeSendText;
  
  // Mock implementation
  const mockSafeSendText = async (sock, jid, text) => {
    attemptCount++;
    console.log(`Attempt ${attemptCount}: Sending message...`);
    
    if (attemptCount < 3) {
      console.log(`Attempt ${attemptCount}: Simulating failure`);
      throw new Error(`Simulated failure on attempt ${attemptCount}`);
    }
    
    console.log(`Attempt ${attemptCount}: Success!`);
    return { status: 1 };
  };
  
  // Replace the global function for testing
  global.safeSendText = mockSafeSendText;
  
  try {
    console.log('Testing retryMessageSend with simulated failures...');
    const result = await retryMessageSend(
      mockSock,
      jid,
      { text: 'This message will succeed after multiple retries' },
      { 
        maxRetries: 3,
        initialDelay: 100, // Short delay for testing
        sendFunction: mockSafeSendText
      }
    );
    
    console.log(`Result: ${result ? 'Success' : 'Failed'}`);
    console.log(`Total attempts: ${attemptCount}`);
  } finally {
    // Restore the original function
    global.safeSendText = originalSafeSendText;
  }
}

// Test the enhanced error message sending
async function testEnhancedErrorMessage() {
  console.log('\n🛠️ Testing Enhanced Error Messages');
  console.log('----------------------------------');
  
  const mockSock = createMockSocket();
  const jid = '1234567890@s.whatsapp.net';
  const errors = createTestErrors();
  const commandName = 'testCommand';
  
  for (const [type, error] of Object.entries(errors)) {
    if (['connection', 'media', 'unknown'].includes(type)) {
      console.log(`\nTesting enhanced error message for ${type} error:`);
      
      // Mock the sendButtons function
      const originalSafeSendButtons = safeSendButtons;
      global.safeSendButtons = async (sock, jid, text, footer, buttons) => {
        // Properly handle the parameters according to the actual function signature
        console.log(`📤 Mock buttons message for ${type} error:`);
        console.log(`Text: ${text}`);
        console.log(`Footer: ${footer}`);
        console.log(`Buttons: ${JSON.stringify(buttons, null, 2)}`);
        return { status: 1 };
      };
      
      try {
        await sendEnhancedErrorMessage(mockSock, jid, error, commandName, type === 'unknown');
      } finally {
        global.safeSendButtons = originalSafeSendButtons;
      }
    }
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Testing Enhanced Error Handling System');
  console.log('=======================================');
  
  // Run all tests
  testErrorCategorization();
  testUserFriendlyMessages();
  await testRetryMessageSend();
  await testEnhancedErrorMessage();
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
});