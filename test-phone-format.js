/**
 * Phone Number Formatting Test Script
 * Tests the enhanced phone number formatting function for various country codes
 */

const { formatPhoneForMention } = require('./src/utils/helpers');

// Sample phone numbers to test
const testNumbers = [
  '8885655@s.whatsapp.net', // User number
  '14155552671@s.whatsapp.net',   // US number
  '919876543210@s.whatsapp.net',  // India number
  '447911123456@s.whatsapp.net',  // UK number
  '33123456789@s.whatsapp.net',   // France number
  '8613912345678@s.whatsapp.net', // China number
  '6281234567890@s.whatsapp.net', // Indonesia number
  '9665012345678@s.whatsapp.net', // Saudi Arabia number
  '12345678@s.whatsapp.net',      // Unknown country code
];

// Test function
function testPhoneFormatting() {
  console.log('Testing Phone Number Formatting');
  console.log('===============================');
  
  testNumbers.forEach(number => {
    const formatted = formatPhoneForMention(number);
    console.log(`Original: ${number}`);
    console.log(`Formatted: ${formatted}`);
    console.log('---------------');
  });
}

// Run the test
testPhoneFormatting();