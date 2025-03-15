/**
 * Fix Temp Paths Script
 * Updates all temp directory paths in media.js to use process.cwd()
 */

const fs = require('fs');
const path = require('path');

async function fixTempPaths() {
  const mediaJsPath = path.join(process.cwd(), 'src', 'commands', 'media.js');
  
  console.log(`Reading ${mediaJsPath}...`);
  
  let content = fs.readFileSync(mediaJsPath, 'utf8');
  
  // Replace all temp directory paths
  const oldPath = /path\.join\(__dirname,\s*['"]\.\.\/\.\.\/temp['"]\)/g;
  const newPath = "path.join(process.cwd(), 'temp')";
  
  // Count how many replacements will be made
  const matches = content.match(oldPath) || [];
  console.log(`Found ${matches.length} occurrences of incorrect temp directory paths.`);
  
  // Make the replacements
  const updatedContent = content.replace(oldPath, newPath);
  
  // Write the updated file
  fs.writeFileSync(mediaJsPath, updatedContent, 'utf8');
  
  console.log(`Updated ${matches.length} temp directory paths in ${mediaJsPath}`);
}

fixTempPaths().catch(console.error);
