// Fix sock.sendMessage to use safeSendText
const fs = require('fs');
const path = require('path');

async function fixFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix sock.sendMessage calls
    content = content.replace(/await sock\.sendMessage\(sender, \{ text: `([^`]+)` \}\);/g, 
      (match, textContent) => {
        return `await safeSendText(sock, sender, \`${textContent}\`);`;
      }
    );
    
    // Fix multi-line sock.sendMessage calls
    content = content.replace(/await sock\.sendMessage\(sender, \{ *\n *text: `([^`]+)` *\n *\}\);/g, 
      (match, textContent) => {
        return `await safeSendText(sock, sender, \`${textContent}\`);`;
      }
    );
    
    // Write fixed content back to file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Error fixing ${filePath}:`, err);
    return false;
  }
}

async function main() {
  // Fix utility.js
  const filePath = path.join(__dirname, 'src/commands/utility.js');
  await fixFile(filePath);
}

main().catch(console.error);