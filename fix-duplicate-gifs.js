/**
 * Script to fix duplicate reaction GIFs and check for missing animations
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to reaction GIFs directory
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
// Path to animated_gifs directory with potential replacements
const ANIMATED_GIFS_DIR = path.join(process.cwd(), 'animated_gifs');

// Create a checksum of file to identify duplicates
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

// Get file size in a human-readable format
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return {
    bytes: stats.size,
    kb: (stats.size / 1024).toFixed(2) + ' KB'
  };
}

// Check if a file is animated
function isAnimatedGif(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    // Check for multiple frames marker in GIF
    // GIF87a and GIF89a both have 0x21 (!) frame markers if animated
    let frameCount = 0;
    for (let i = 0; i < buffer.length - 3; i++) {
      // Look for frame separator: 0x21, 0xF9, 0x04 (frame control extension)
      if (buffer[i] === 0x21 && buffer[i + 1] === 0xF9 && buffer[i + 2] === 0x04) {
        frameCount++;
        if (frameCount > 1) {
          // If we find multiple frame markers, it's animated
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    console.error(`Error checking if ${filePath} is animated:`, err.message);
    return false;
  }
}

// Check all GIFs in the reaction_gifs directory
async function checkReactionGifs() {
  console.log('Checking reaction GIFs for duplicates and issues...\n');
  
  const files = fs.readdirSync(REACTIONS_DIR)
    .filter(file => file.endsWith('.gif') && !file.startsWith('.'));
  
  const checksums = new Map();
  const duplicates = [];
  const nonAnimated = [];
  
  // Analyze each file
  for (const file of files) {
    const filePath = path.join(REACTIONS_DIR, file);
    const checksum = calculateChecksum(filePath);
    const size = getFileSize(filePath);
    const animated = isAnimatedGif(filePath);
    
    // Check if we've seen this checksum before
    if (checksums.has(checksum)) {
      duplicates.push({
        file,
        duplicateOf: checksums.get(checksum),
        size
      });
    } else {
      checksums.set(checksum, file);
    }
    
    // Check if the GIF is not animated
    if (!animated) {
      nonAnimated.push({
        file,
        size
      });
    }
    
    console.log(`${file}: ${size.kb} ${animated ? '✅ Animated' : '❌ Static'}`);
  }
  
  console.log('\n=== Results ===');
  
  // Report duplicates
  if (duplicates.length > 0) {
    console.log('\nDuplicate GIFs found:');
    duplicates.forEach(dup => {
      console.log(`${dup.file} is a duplicate of ${dup.duplicateOf} (${dup.size.kb})`);
    });
  } else {
    console.log('\nNo duplicate GIFs found.');
  }
  
  // Report non-animated GIFs
  if (nonAnimated.length > 0) {
    console.log('\nNon-animated GIFs found:');
    nonAnimated.forEach(file => {
      console.log(`${file.file} (${file.size.kb}) is not animated`);
    });
  } else {
    console.log('\nAll GIFs are animated.');
  }
  
  // Check if we have replacement GIFs available
  if (fs.existsSync(ANIMATED_GIFS_DIR)) {
    console.log('\nChecking for replacement GIFs in animated_gifs directory...');
    
    const replacementFiles = fs.readdirSync(ANIMATED_GIFS_DIR)
      .filter(file => file.endsWith('.gif') && !file.startsWith('.'));
      
    const possibleReplacements = nonAnimated
      .filter(na => replacementFiles.includes(na.file))
      .map(na => na.file);
    
    if (possibleReplacements.length > 0) {
      console.log('The following files can be replaced with animated versions:');
      possibleReplacements.forEach(file => {
        console.log(`- ${file} (replacement available in animated_gifs)`);
      });
      
      // Ask if user wants to replace the files
      console.log('\nWould you like to replace these static GIFs with animated versions? (y/n)');
      // Since we can't get input directly, we'll just show how to replace
      console.log('\nTo replace the files, run:');
      possibleReplacements.forEach(file => {
        console.log(`cp ${path.join(ANIMATED_GIFS_DIR, file)} ${path.join(REACTIONS_DIR, file)}`);
      });
    } else {
      console.log('No replacement GIFs found in animated_gifs directory.');
    }
  }
  
  return {
    duplicates,
    nonAnimated
  };
}

// Run the check
checkReactionGifs().catch(err => {
  console.error('Error checking reaction GIFs:', err);
});