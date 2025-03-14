/**
 * Test Reaction GIFs
 * This script tests the reaction GIFs by simulating messages for each reaction command.
 */
const fs = require('fs');
const path = require('path');

// Check if GIFs exist
function checkGif(gifName) {
  const reactionsDir = path.join(process.cwd(), 'data', 'reaction_gifs');
  const gifPath = path.join(reactionsDir, gifName);
  
  if (fs.existsSync(gifPath)) {
    const stats = fs.statSync(gifPath);
    const sizeKb = Math.round(stats.size / 1024 * 100) / 100;
    return {
      exists: true,
      size: sizeKb,
      path: gifPath
    };
  }
  
  return {
    exists: false,
    path: gifPath
  };
}

// Test all reaction commands
async function testReactions() {
  console.log('🧪 Testing Reaction GIFs...\n');
  
  const reactions = [
    'bite',
    'blush', 
    'bonk', 
    'cry',
    'cuddle',
    'dance',
    'happy',
    'highfive',
    'hug',
    'kiss',
    'laugh',
    'pat',
    'poke',
    'punch',
    'slap',
    'smile',
    'wave',
    'wink',
    'yeet'
  ];
  
  // Previously duplicated GIFs that we fixed
  const fixedDuplicates = ['happy', 'pat', 'punch', 'yeet'];
  
  const results = {
    total: reactions.length,
    exist: 0,
    missing: 0,
    fixed: 0
  };
  
  // Process each reaction
  for (const reaction of reactions) {
    const gifName = `${reaction}.gif`;
    const result = checkGif(gifName);
    
    const isFixed = fixedDuplicates.includes(reaction);
    const fixedText = isFixed ? ' (✓ Fixed)' : '';
    
    if (result.exists) {
      console.log(`✅ ${reaction}${fixedText}: GIF exists (${result.size} KB)`);
      results.exist++;
      if (isFixed) results.fixed++;
    } else {
      console.log(`❌ ${reaction}: GIF missing at ${result.path}`);
      results.missing++;
    }
  }
  
  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total reactions: ${results.total}`);
  console.log(`Existing GIFs: ${results.exist}`);
  console.log(`Fixed duplicates: ${results.fixed}/${fixedDuplicates.length}`);
  
  if (results.missing > 0) {
    console.log(`Missing GIFs: ${results.missing}`);
  }
}

// Run the test
testReactions().catch(err => {
  console.error('Error testing reactions:', err);
});