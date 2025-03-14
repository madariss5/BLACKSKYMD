// Fix safeSendText formatting issues
const fs = require('fs');
const path = require('path');

async function fixFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add trailing space cleanup
    content = content.replace(/await safeSendText\(sock, [^,]+, ['"`][^'"`]+['"`]\s*\)/g, (match) => {
      return match.trim();
    });
    
    // Fix trailing ) in multi-line statements
    content = content.replace(/await safeSendText\(sock, [^,]+, ['"`][^'"`]+(["'`])\s*\n\s*\);/g, (match, quote) => {
      return match.replace(/\s*\n\s*\);/, `${quote});`);
    });
    
    // Fix multi-space and trailing spaces around safeSendText
    content = content.replace(/await\s+safeSendText\s*\(/g, 'await safeSendText(');
    
    // Fix safeSendText with trailing spaces after text argument
    content = content.replace(/(['"`])([^'"]*)\s+\1\s*\)/g, '$1$2$1)');
    
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
  // Fix utility.js and educational modules
  const files = [
    'src/commands/utility.js', 
    'src/commands/educational/commands.js'
  ];
  
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    await fixFile(filePath);
  }
}

main().catch(console.error);