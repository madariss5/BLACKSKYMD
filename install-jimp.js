/**
 * Install Jimp for Canvas/Sharp Polyfills
 * 
 * This script ensures that Jimp is installed, which is needed for 
 * the polyfill implementations to work properly.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Checking for Jimp installation...');

// Check if Jimp is already installed
const nodeModulesDir = path.join(__dirname, 'node_modules');
const jimpDir = path.join(nodeModulesDir, 'jimp');

if (fs.existsSync(jimpDir) && fs.existsSync(path.join(jimpDir, 'package.json'))) {
  console.log('✅ Jimp is already installed.');
} else {
  console.log('⚠️ Jimp is not installed. Installing now...');
  
  // Install Jimp using npm
  exec('npm install --no-package-lock jimp@0.22.8', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error installing Jimp: ${error.message}`);
      console.log('Trying alternative installation method...');
      
      // If npm install fails, try a direct download
      exec('mkdir -p node_modules/jimp && wget -O jimp.tgz https://registry.npmjs.org/jimp/-/jimp-0.22.8.tgz && tar -xzf jimp.tgz -C node_modules/jimp --strip-components=1 && rm jimp.tgz', 
        (error2, stdout2, stderr2) => {
          if (error2) {
            console.error(`❌ Alternative installation failed: ${error2.message}`);
            console.log('Please manually install Jimp with: npm install jimp');
          } else {
            console.log('✅ Jimp installed successfully using alternative method.');
          }
        }
      );
    } else {
      console.log('✅ Jimp installed successfully.');
      console.log(stdout);
    }
  });
}

// Create a minimal package.json if it doesn't exist
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.log('Creating minimal package.json...');
  const packageJson = {
    name: "blacksky-md-termux",
    version: "1.0.0",
    description: "BLACKSKY-MD WhatsApp Bot for Termux",
    main: "src/termux-connection.js",
    dependencies: {
      "@whiskeysockets/baileys": "^6.5.0",
      "qrcode-terminal": "^0.12.0",
      "jimp": "^0.22.8"
    }
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Created package.json file.');
}

console.log('✅ Setup complete. Please run the fix-module-loading.js script again if Jimp was just installed.');