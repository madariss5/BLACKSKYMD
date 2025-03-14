/**
 * Simple Command Validation Script
 * This script tests if the module structure in fun.js and nsfw.js is correct
 */

try {
  console.log('Testing fun.js module...');
  const funModule = require('./src/commands/fun.js');
  
  if (funModule.commands && funModule.category && funModule.init) {
    console.log('✅ fun.js has valid structure');
    const cmdCount = Object.keys(funModule.commands).length;
    console.log(`   - Found ${cmdCount} commands in fun.js`);
    console.log(`   - Commands: ${Object.keys(funModule.commands).join(', ')}`);
  } else {
    console.log('❌ fun.js has invalid structure');
    console.log('   Missing properties:', 
      !funModule.commands ? 'commands' : '',
      !funModule.category ? 'category' : '',
      !funModule.init ? 'init' : ''
    );
  }
  
  console.log('\nTesting nsfw.js module...');
  const nsfwModule = require('./src/commands/nsfw.js');
  
  if (nsfwModule.commands && nsfwModule.category && nsfwModule.init) {
    console.log('✅ nsfw.js has valid structure');
    const cmdCount = Object.keys(nsfwModule.commands).length;
    console.log(`   - Found ${cmdCount} commands in nsfw.js`);
    console.log(`   - Commands: ${Object.keys(nsfwModule.commands).join(', ')}`);
  } else {
    console.log('❌ nsfw.js has invalid structure');
    console.log('   Missing properties:', 
      !nsfwModule.commands ? 'commands' : '',
      !nsfwModule.category ? 'category' : '',
      !nsfwModule.init ? 'init' : ''
    );
  }
  
  console.log('\nTest complete!');
} catch (err) {
  console.error('Error during testing:', err);
}