/**
 * Replace duplicate GIFs with unique ones from the attached_assets folder
 */
const fs = require('fs');
const path = require('path');

// Directories
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const ASSETS_DIR = path.join(process.cwd(), 'attached_assets');

// GIFs to replace and their replacements from attached_assets
const REPLACEMENTS = {
  'happy.gif': 'heavenly-joy-jerkins-i-am-so-excited.gif', // Happy excitement
  'pat.gif': 'BT_L5v.gif', // Pat/head touch
  'punch.gif': '2Lmc.gif', // Punching action
  'yeet.gif': 'B6ya.gif'  // Throwing action
};

/**
 * Backup the original GIF if not already backed up
 */
function backupGif(filePath) {
  const backupPath = `${filePath}.backup`;
  try {
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`✅ Backed up ${path.basename(filePath)} to ${path.basename(backupPath)}`);
    } else {
      console.log(`ℹ️ Backup already exists for ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error backing up ${filePath}:`, error.message);
  }
}

/**
 * Replace a GIF with a new one from assets
 */
function replaceGif(originalName, replacementName) {
  const originalPath = path.join(REACTIONS_DIR, originalName);
  const replacementPath = path.join(ASSETS_DIR, replacementName);
  const detailDir = path.join(REACTIONS_DIR, 'detail_info');
  
  try {
    // Check if files exist
    if (!fs.existsSync(originalPath)) {
      console.error(`❌ Original file not found: ${originalPath}`);
      return false;
    }
    
    if (!fs.existsSync(replacementPath)) {
      console.error(`❌ Replacement file not found: ${replacementPath}`);
      return false;
    }
    
    // Create detail_info directory if it doesn't exist
    if (!fs.existsSync(detailDir)) {
      fs.mkdirSync(detailDir, { recursive: true });
    }
    
    // Backup original file
    backupGif(originalPath);
    
    // Copy the replacement GIF
    fs.copyFileSync(replacementPath, originalPath);
    console.log(`✅ Replaced ${originalName} with ${replacementName}`);
    
    // Save attribution info
    const infoPath = path.join(detailDir, `${path.basename(originalName, '.gif')}.txt`);
    fs.writeFileSync(infoPath, `Source: attached_assets folder\nReplacement file: ${replacementName}\nReplaced: ${new Date().toISOString()}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error replacing ${originalName}:`, error.message);
    return false;
  }
}

/**
 * Main function to replace all duplicate GIFs
 */
function replaceAllGifs() {
  console.log('🔄 Starting to replace duplicate GIFs with unique ones...');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [original, replacement] of Object.entries(REPLACEMENTS)) {
    console.log(`🔄 Processing ${original} => ${replacement}`);
    if (replaceGif(original, replacement)) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n✅ Successfully replaced ${successCount} GIFs`);
  if (failCount > 0) {
    console.log(`❌ Failed to replace ${failCount} GIFs`);
  }
  console.log('🎉 GIF replacement process completed!');
}

// Execute the replacement
replaceAllGifs();