// Fix quotes in utility.js
const fs = require('fs');
const path = require('path');

async function fixFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find all lines with ending with '' quote issue
    content = content.replace(/safeSendText\(sock, sender, '[^']*''\);/g, (match) => {
      // Replace the ending '' with single '
      return match.replace("'');", "');");
    });
    
    // Find all lines with mixed string quotes 
    content = content.replace(/safeSendText\(sock, sender, '[^']*`[^`]*`'\);/g, (match) => {
      // Extract the string content and fix quotes
      const startIndex = match.indexOf("'") + 1;
      const endIndex = match.lastIndexOf("'");
      const textContent = match.substring(startIndex, endIndex);
      return `safeSendText(sock, sender, '${textContent.replace(/`/g, "'")}');`;
    });
    
    // Fix backtick template literals
    content = content.replace(/await safeSendText\(sock, sender, \$\{.*?\}\);/g, (match) => {
      // Add backticks to template literals
      return match.replace("$(", "`${").replace(");", "}`);");
    });
    
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