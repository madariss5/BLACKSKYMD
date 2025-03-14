/**
 * Educational Module Fixer
 * This script addresses the specific issue with educational command loading
 */

const fs = require('fs').promises;
const path = require('path');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function fixEducationalModule() {
  console.log('🔧 Fixing educational module loading...');
  
  const educationalDir = path.join(__dirname, 'src', 'commands');
  const mainFile = path.join(educationalDir, 'educational.js');
  const nestedFile = path.join(educationalDir, 'educational', 'commands.js');
  
  // Check if both files exist
  const mainExists = await exists(mainFile);
  const nestedExists = await exists(nestedFile);
  
  if (!mainExists) {
    console.log('❌ Main educational.js file not found at:', mainFile);
    return false;
  }

  if (!nestedExists) {
    console.log('❌ Nested commands.js file not found at:', nestedFile);
    return false;
  }
  
  console.log('✅ Found both educational module files');
  
  try {
    // Read main educational.js
    const mainContent = await fs.readFile(mainFile, 'utf8');
    
    // Check if it already imports commands properly
    if (mainContent.includes('./educational/commands') || mainContent.includes('./educational/index')) {
      console.log('✅ educational.js already imports commands correctly:');
      console.log('---------------------');
      console.log(mainContent);
      console.log('---------------------');
      return true;
    }
    
    console.log('❌ educational.js does not properly import commands');
    
    // Create proper import content
    const fixedContent = `/**
 * Educational Commands for WhatsApp Bot
 * Access to educational tools and features
 */

const educationalCommands = require('./educational/commands');

// Export commands with category information
module.exports = {
  ...educationalCommands,
  category: 'educational'
};
`;

    // Backup original file
    await fs.writeFile(`${mainFile}.bak`, mainContent);
    console.log('✅ Created backup of original educational.js');
    
    // Write fixed content
    await fs.writeFile(mainFile, fixedContent);
    console.log('✅ Updated educational.js to import commands properly');
    
    // Read commands file to check structure
    const commandsContent = await fs.readFile(nestedFile, 'utf8');
    console.log('ℹ️ Commands file found with size:', commandsContent.length, 'bytes');
    
    // Check for module.exports format
    const hasStandardExport = commandsContent.includes('module.exports =');
    if (!hasStandardExport) {
      console.log('⚠️ Warning: Commands file may have non-standard export format');
    } else {
      console.log('✅ Commands file has standard module.exports format');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing educational module:', error.message);
    return false;
  }
}

// Run the educational module fixer
fixEducationalModule()
  .then(success => {
    if (success) {
      console.log('✅ Educational module fix completed successfully');
    } else {
      console.log('❌ Educational module fix failed');
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });