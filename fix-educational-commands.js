/**
 * Fix Educational Commands Module
 * This script specifically fixes the educational/commands.js file
 */

const fs = require('fs');
const path = require('path');

// Path to the educational commands file
const filePath = path.join(__dirname, 'src', 'commands', 'educational', 'commands.js');

// Read the file content
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Replace the duplicate import
  const fixedContent = data.replace(
    /const { safeSendText, safeSendMessage, safeSendImage } = require\('\.\.\/\.\.\/utils\/jidHelper'\);\s*const { safeSendMessage, safeSendText, safeSendImage } = require\('\.\.\/utils\/jidHelper'\);/,
    "const { safeSendText, safeSendMessage, safeSendImage } = require('../../utils/jidHelper');"
  );

  // Write the fixed content back to the file
  fs.writeFile(filePath, fixedContent, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('Error writing file:', writeErr);
      return;
    }
    
    console.log('✅ Successfully fixed educational commands module!');
  });
});