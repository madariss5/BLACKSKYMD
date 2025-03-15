/**
 * Test for Updated Phone Formatting Object
 * Verifies that the formatPhoneForMention function returns both international and formatted numbers
 */

const { formatPhoneForMention } = require('./src/utils/helpers');

// Sample phone numbers to test
const testNumbers = [
  '4915561048015@s.whatsapp.net',  // German number
  '12036340763@s.whatsapp.net',    // Number from screenshot
  '858556@s.whatsapp.net'          // Short number 
];

function testFormatting() {
  console.log('Testing Updated Phone Formatting Function');
  console.log('=========================================');
  
  testNumbers.forEach(number => {
    console.log(`Original JID: ${number}`);
    const result = formatPhoneForMention(number);
    console.log(`International: ${result.international}`);
    console.log(`Formatted: ${result.formatted}`);
    console.log('-----------------');
  });
}

// Run the test
testFormatting();