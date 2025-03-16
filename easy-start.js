/**
 * WhatsApp Bot Easy Start Script
 * This script provides a user-friendly interface to select and start WhatsApp connection methods
 */

const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const AUTH_PATHS = [
  './auth_info_baileys',
  './auth_info_safari',
  './auth_info_persistent',
  './auth_info_enhanced', 
  './auth_info_flash'
];

// Interactive console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility functions
function clearScreen() {
  console.clear();
}

function showHeader() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        BLACKSKY-MD WHATSAPP BOT LAUNCHER     ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
}

function showImportHeader() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        AUTHENTICATION SESSION IMPORTER       ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
}

function showConnectionHeader() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        CONNECTION METHOD SELECTION          ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function checkAuthStatus() {
  console.log("Checking for authentication data...");
  
  const results = await Promise.all(AUTH_PATHS.map(async (authPath) => {
    try {
      if (!fs.existsSync(authPath)) {
        return { path: authPath, exists: false, valid: false };
      }
      
      const files = fs.readdirSync(authPath);
      const hasCredsJson = files.includes('creds.json');
      
      let isValid = false;
      if (hasCredsJson) {
        try {
          const credsPath = path.join(authPath, 'creds.json');
          const credsContent = fs.readFileSync(credsPath, 'utf8');
          const creds = JSON.parse(credsContent);
          isValid = creds.me && creds.me.id;
        } catch (e) {
          isValid = false;
        }
      }
      
      return { 
        path: authPath, 
        exists: true, 
        fileCount: files.length,
        hasCredsJson, 
        valid: isValid 
      };
    } catch (err) {
      return { path: authPath, exists: false, valid: false, error: err.message };
    }
  }));
  
  return results;
}

function getConnectionInfo(result) {
  const name = result.path.replace('./auth_info_', '').replace('_', ' ');
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    status: result.valid ? 'Ready' : (result.exists ? 'Invalid' : 'Not found')
  };
}

async function mainMenu() {
  const authResults = await checkAuthStatus();
  const hasValidAuth = authResults.some(r => r.valid);
  
  clearScreen();
  showHeader();
  
  if (hasValidAuth) {
    console.log("✅ Authentication data found! You can connect immediately.");
    console.log();
    
    console.log("Available connection methods:");
    authResults.forEach((result, index) => {
      if (result.valid) {
        const info = getConnectionInfo(result);
        console.log(`  ${index + 1}. ${info.name} Connection [${info.status}]`);
      }
    });
    
    console.log();
    console.log("  A. Import session from local device");
    console.log("  I. Show connection information");
    console.log("  Q. Quit");
    
    const choice = await ask("\nSelect an option: ");
    
    const num = parseInt(choice);
    if (!isNaN(num) && num > 0 && num <= authResults.length) {
      const selected = authResults[num - 1];
      if (selected.valid) {
        await startConnection(selected.path);
      } else {
        console.log("\n❌ This connection method is not ready.");
        console.log("Please import auth data first using option A.");
        await ask("\nPress Enter to continue...");
        return mainMenu();
      }
    } else if (choice.toLowerCase() === 'a') {
      await importSession();
    } else if (choice.toLowerCase() === 'i') {
      await showConnectionInfo(authResults);
    } else if (choice.toLowerCase() === 'q') {
      rl.close();
      return;
    } else {
      console.log("\n❌ Invalid selection. Try again.");
      await ask("\nPress Enter to continue...");
      return mainMenu();
    }
  } else {
    console.log("❌ No valid authentication data found.");
    console.log();
    console.log("You need to:");
    console.log("1. Run on your local machine: node local-connect.js");
    console.log("2. Scan the QR code with WhatsApp on your phone");
    console.log("3. Upload the auth_info_baileys folder to this Replit");
    console.log("4. Import the credentials to connect");
    console.log();
    
    console.log("What would you like to do?");
    console.log("  1. Import authentication data");
    console.log("  2. Start with pairing code (not recommended)");
    console.log("  3. View connection guide");
    console.log("  Q. Quit");
    
    const choice = await ask("\nSelect an option: ");
    
    if (choice === '1') {
      await importSession();
    } else if (choice === '2') {
      await selectPairingMethod();
    } else if (choice === '3') {
      await viewConnectionGuide();
    } else if (choice.toLowerCase() === 'q') {
      rl.close();
      return;
    } else {
      console.log("\n❌ Invalid selection. Try again.");
      await ask("\nPress Enter to continue...");
      return mainMenu();
    }
  }
}

async function showConnectionInfo(authResults) {
  clearScreen();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       WHATSAPP CONNECTION INFORMATION        ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
  
  console.log("Authentication Status:");
  
  authResults.forEach(result => {
    const info = getConnectionInfo(result);
    console.log(`\n${info.name} Connection:`);
    console.log(`  Status: ${info.status}`);
    console.log(`  Path: ${result.path}`);
    
    if (result.exists) {
      console.log(`  Files: ${result.fileCount}`);
      console.log(`  Has creds.json: ${result.hasCredsJson ? 'Yes' : 'No'}`);
      
      if (result.valid && result.hasCredsJson) {
        try {
          const credsPath = path.join(result.path, 'creds.json');
          const credsContent = fs.readFileSync(credsPath, 'utf8');
          const creds = JSON.parse(credsContent);
          if (creds.me) {
            console.log(`  Account: ${creds.me.name || 'Unknown'} (${creds.me.id.split(':')[0]})`);
          }
        } catch (e) {
          console.log(`  Error reading credentials: ${e.message}`);
        }
      }
    }
  });
  
  console.log("\nFor best results:");
  console.log("- Safari and Firefox browser fingerprints work best");
  console.log("- Local auth transfer is the most reliable method");
  console.log("- Credentials expire every 1-4 weeks");
  
  await ask("\nPress Enter to return to the main menu...");
  return mainMenu();
}

async function importSession() {
  clearScreen();
  showImportHeader();
  
  console.log("This will import authentication data from your local machine.");
  console.log("You should have already:");
  console.log("1. Run node local-connect.js on your computer");
  console.log("2. Scanned the QR code with your phone");
  console.log("3. Uploaded the auth_info_baileys folder to this Replit");
  console.log();
  
  const proceed = await ask("Continue with import? (y/n): ");
  
  if (proceed.toLowerCase() !== 'y') {
    return mainMenu();
  }
  
  console.log("\nRunning import script...");
  try {
    const { stdout, stderr } = await execPromise('node import-session.js');
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log("\n✅ Import process completed.");
    console.log("You can now select a connection method from the main menu.");
  } catch (err) {
    console.error("\n❌ Error during import:", err.message);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    
    console.log("\nPossible solutions:");
    console.log("1. Make sure auth_info_baileys folder exists at the root level");
    console.log("2. Check if you have permission issues");
    console.log("3. Try running node import-session.js manually");
  }
  
  await ask("\nPress Enter to return to the main menu...");
  return mainMenu();
}

async function selectPairingMethod() {
  clearScreen();
  showConnectionHeader();
  
  console.log("⚠️ WARNING: These methods may not work reliably in cloud environments");
  console.log("For best results, use the local auth transfer method instead.");
  console.log();
  
  console.log("Available connection methods:");
  console.log("  1. Safari Connect (Recommended)");
  console.log("  2. Enhanced Pairing Code");
  console.log("  3. FLASH-MD Pairing");
  console.log("  4. Simple Pairing Code");
  console.log("  B. Back to main menu");
  
  const choice = await ask("\nSelect a connection method: ");
  
  if (choice === '1') {
    await startScript('safari-connect.js', 'Safari Connect');
  } else if (choice === '2') {
    await startScript('enhanced-pairing-code.js', 'Enhanced Pairing Code');
  } else if (choice === '3') {
    await startScript('flash-md-connect.js', 'FLASH-MD');
  } else if (choice === '4') {
    await startScript('simple-pairing-code.js', 'Simple Pairing Code');
  } else if (choice.toLowerCase() === 'b') {
    return mainMenu();
  } else {
    console.log("\n❌ Invalid selection. Try again.");
    await ask("\nPress Enter to continue...");
    return selectPairingMethod();
  }
}

async function startConnection(authPath) {
  const method = authPath.replace('./auth_info_', '');
  
  let scriptPath = 'safari-connect.js';
  let displayName = 'Safari Connect';
  
  if (method === 'persistent') {
    scriptPath = 'persistent-connection.js';
    displayName = 'Persistent Connection';
  } else if (method === 'baileys') {
    scriptPath = 'connected-bot.js';
    displayName = 'Standard Connection';
  } else if (method === 'flash') {
    scriptPath = 'flash-md-connect.js';
    displayName = 'FLASH-MD Connection';
  } else if (method === 'enhanced') {
    scriptPath = 'enhanced-pairing-code.js';
    displayName = 'Enhanced Connection';
  }
  
  await startScript(scriptPath, displayName);
}

async function startScript(scriptPath, displayName) {
  clearScreen();
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║       STARTING ${displayName.toUpperCase().padEnd(26)}║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log();
  
  console.log(`Starting ${displayName}...`);
  console.log("Press Ctrl+C to stop the process.\n");
  
  try {
    const child = exec(`node ${scriptPath}`);
    
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    child.on('close', async (code) => {
      console.log(`\nProcess exited with code ${code}`);
      await ask("\nPress Enter to return to the main menu...");
      return mainMenu();
    });
    
    // Keep the main process alive until child exits
    await new Promise((resolve) => {
      child.on('exit', resolve);
    });
  } catch (err) {
    console.error(`\n❌ Error starting ${displayName}:`, err.message);
    await ask("\nPress Enter to return to the main menu...");
    return mainMenu();
  }
}

async function viewConnectionGuide() {
  clearScreen();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       WHATSAPP CONNECTION GUIDE             ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
  
  try {
    if (fs.existsSync('CLOUD_ENVIRONMENT_GUIDE.md')) {
      const guide = fs.readFileSync('CLOUD_ENVIRONMENT_GUIDE.md', 'utf8');
      console.log(guide);
    } else {
      console.log("Connection guide not found. Please refer to the documentation.");
    }
  } catch (err) {
    console.error("Error reading connection guide:", err.message);
  }
  
  await ask("\nPress Enter to return to the main menu...");
  return mainMenu();
}

// Start the application
async function start() {
  try {
    await mainMenu();
  } catch (err) {
    console.error("Error:", err);
    rl.close();
  }
}

// Run the program
start();