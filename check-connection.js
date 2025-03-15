/**
 * WhatsApp Connection Status Checker
 * This tool helps diagnose connection issues with WhatsApp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dns = require('dns');
const http = require('http');
const https = require('https');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

console.log(`${colors.cyan}
╔══════════════════════════════════════════════════════╗
║                                                      ║
║        WhatsApp Connection Diagnostics Tool          ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
${colors.reset}`);

// Check if auth state exists
function checkAuthState() {
  const authDirs = [
    './auth_info_baileys',
    './auth_info_simple',
    './auth_info_baileys_qr'
  ];
  
  console.log(`${colors.blue}[1/6] Checking authentication state...${colors.reset}`);
  
  let anyAuthExists = false;
  for (const dir of authDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      if (files.length > 0) {
        console.log(`  ${colors.green}✓ Auth files exist in ${dir}${colors.reset}`);
        anyAuthExists = true;
      } else {
        console.log(`  ${colors.yellow}! Directory ${dir} exists but is empty${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.yellow}! Directory ${dir} not found${colors.reset}`);
    }
  }
  
  if (!anyAuthExists) {
    console.log(`  ${colors.red}✗ No authentication files found in any directory${colors.reset}`);
    console.log(`  ${colors.yellow}→ You will need to scan the QR code to connect${colors.reset}`);
  }
  
  return anyAuthExists;
}

// Check network connectivity
async function checkNetworkConnectivity() {
  console.log(`\n${colors.blue}[2/6] Checking network connectivity...${colors.reset}`);

  // Check DNS resolution
  function checkDNS(domain) {
    return new Promise(resolve => {
      dns.lookup(domain, (err, address) => {
        if (err) {
          console.log(`  ${colors.red}✗ DNS lookup failed for ${domain}: ${err.message}${colors.reset}`);
          resolve(false);
        } else {
          console.log(`  ${colors.green}✓ DNS resolution for ${domain}: ${address}${colors.reset}`);
          resolve(true);
        }
      });
    });
  }
  
  // Check HTTP connectivity
  function checkHTTP(url) {
    return new Promise(resolve => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: 5000 }, res => {
        const statusCode = res.statusCode;
        res.destroy();
        if (statusCode >= 200 && statusCode < 400) {
          console.log(`  ${colors.green}✓ HTTP connection to ${url}: Status ${statusCode}${colors.reset}`);
          resolve(true);
        } else {
          console.log(`  ${colors.yellow}! HTTP connection to ${url}: Status ${statusCode}${colors.reset}`);
          resolve(false);
        }
      });
      
      req.on('error', err => {
        console.log(`  ${colors.red}✗ HTTP connection to ${url} failed: ${err.message}${colors.reset}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        console.log(`  ${colors.red}✗ HTTP connection to ${url} timed out${colors.reset}`);
        req.destroy();
        resolve(false);
      });
    });
  }
  
  // Run the checks
  try {
    const domains = ['web.whatsapp.com', 'g.whatsapp.net', 'mmg.whatsapp.net'];
    const urls = ['https://web.whatsapp.com', 'https://g.whatsapp.net'];
    
    let allPass = true;
    for (const domain of domains) {
      const result = await checkDNS(domain);
      allPass = allPass && result;
    }
    
    for (const url of urls) {
      const result = await checkHTTP(url);
      allPass = allPass && result;
    }
    
    return allPass;
  } catch (error) {
    console.log(`  ${colors.red}✗ Error during network checks: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check for recent connection errors
function checkConnectionErrors() {
  console.log(`\n${colors.blue}[3/6] Checking for recent connection errors...${colors.reset}`);
  
  try {
    // Helper to check logs for error patterns
    function checkLogForErrors(log) {
      const errorPatterns = [
        { pattern: 'Connection Failure', severity: 'high', solution: 'Try a different connection method or IP address' },
        { pattern: 'Stream Errored', severity: 'medium', solution: 'Check your network connectivity' },
        { pattern: 'Unexpected server response', severity: 'medium', solution: 'WhatsApp servers might be rejecting the connection' },
        { pattern: 'timed out', severity: 'medium', solution: 'Your network might be slow or unstable' },
        { pattern: 'loggedOut', severity: 'high', solution: 'Your session was logged out, need to re-scan QR code' }
      ];
      
      let foundErrors = [];
      for (const { pattern, severity, solution } of errorPatterns) {
        if (log.includes(pattern)) {
          foundErrors.push({ pattern, severity, solution });
        }
      }
      
      return foundErrors;
    }
    
    // Check for log files first
    const logFiles = ['./log.txt', './error.log', './connection.log'];
    let foundLogFile = false;
    let foundErrors = [];
    
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        foundLogFile = true;
        const log = fs.readFileSync(logFile, 'utf8');
        foundErrors = checkLogForErrors(log);
        
        if (foundErrors.length > 0) {
          console.log(`  ${colors.red}✗ Found errors in ${logFile}:${colors.reset}`);
          foundErrors.forEach(({ pattern, severity, solution }) => {
            const severityColor = severity === 'high' ? colors.red : colors.yellow;
            console.log(`    ${severityColor}• ${pattern} (${severity}): ${solution}${colors.reset}`);
          });
        } else {
          console.log(`  ${colors.green}✓ No known errors found in ${logFile}${colors.reset}`);
        }
      }
    }
    
    if (!foundLogFile) {
      console.log(`  ${colors.yellow}! No log files found to check${colors.reset}`);
      console.log(`  ${colors.yellow}→ Running with logging enabled is recommended for debugging${colors.reset}`);
    }
    
    return foundErrors.length === 0;
  } catch (error) {
    console.log(`  ${colors.red}✗ Error while checking logs: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check WhatsApp dependencies
function checkDependencies() {
  console.log(`\n${colors.blue}[4/6] Checking WhatsApp dependencies...${colors.reset}`);
  
  try {
    // Read package.json
    const packagePath = './package.json';
    if (!fs.existsSync(packagePath)) {
      console.log(`  ${colors.red}✗ package.json not found${colors.reset}`);
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const dependencies = packageJson.dependencies || {};
    
    // Check for essential libraries
    const requiredDeps = [
      '@whiskeysockets/baileys',
      'qrcode',
      'qrcode-terminal',
      'pino'
    ];
    
    let allDepsPresent = true;
    for (const dep of requiredDeps) {
      if (dependencies[dep]) {
        console.log(`  ${colors.green}✓ Found dependency: ${dep} (${dependencies[dep]})${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ Missing dependency: ${dep}${colors.reset}`);
        allDepsPresent = false;
      }
    }
    
    // Check for correct version of Node.js
    try {
      const nodeVersion = execSync('node --version').toString().trim();
      console.log(`  ${colors.green}✓ Node.js version: ${nodeVersion}${colors.reset}`);
      
      // Parse version
      const version = nodeVersion.replace('v', '').split('.');
      const major = parseInt(version[0]);
      
      if (major < 14) {
        console.log(`  ${colors.yellow}! Node.js version may be too old. Version 14 or later is recommended.${colors.reset}`);
      }
    } catch (error) {
      console.log(`  ${colors.red}✗ Error checking Node.js version: ${error.message}${colors.reset}`);
    }
    
    return allDepsPresent;
  } catch (error) {
    console.log(`  ${colors.red}✗ Error checking dependencies: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check connection methods
function checkConnectionMethods() {
  console.log(`\n${colors.blue}[5/6] Checking available connection methods...${colors.reset}`);
  
  const connectionMethods = [
    { name: 'Standard Web Connection', file: './src/index.js', desc: 'Default connection method with web interface' },
    { name: 'Web QR Generator', file: './src/qr-generator.js', desc: 'Alternative connection with specialized parameters' },
    { name: 'Terminal QR', file: './src/terminal-qr.js', desc: 'Most reliable terminal-based connection' },
    { name: 'Connection Helper', file: './run-connection.js', desc: 'Interactive connection method selector' }
  ];
  
  let anyMethodAvailable = false;
  for (const method of connectionMethods) {
    if (fs.existsSync(method.file)) {
      console.log(`  ${colors.green}✓ ${method.name} available: ${method.file}${colors.reset}`);
      console.log(`    ${colors.cyan}→ ${method.desc}${colors.reset}`);
      anyMethodAvailable = true;
    } else {
      console.log(`  ${colors.red}✗ ${method.name} NOT available: ${method.file}${colors.reset}`);
    }
  }
  
  if (!anyMethodAvailable) {
    console.log(`  ${colors.red}✗ No connection methods available!${colors.reset}`);
    console.log(`  ${colors.yellow}→ Project may be misconfigured${colors.reset}`);
  }
  
  return anyMethodAvailable;
}

// Generate overall diagnosis
function generateDiagnosis(results) {
  console.log(`\n${colors.blue}[6/6] Generating overall diagnosis...${colors.reset}`);
  
  const { authState, network, errors, dependencies, methods } = results;
  
  // Count passed checks
  const passedCount = [authState, network, errors, dependencies, methods].filter(Boolean).length;
  const totalChecks = 5;
  const percentage = Math.round((passedCount / totalChecks) * 100);
  
  console.log(`  ${colors.cyan}Connection Health: ${percentage}% (${passedCount}/${totalChecks} checks passed)${colors.reset}`);
  
  if (percentage === 100) {
    console.log(`\n${colors.green}✅ All checks passed! Your system should be able to connect to WhatsApp.${colors.reset}`);
    console.log(`${colors.green}  If you're still experiencing issues, they may be:${colors.reset}`);
    console.log(`${colors.green}  - Temporary restrictions from WhatsApp's servers${colors.reset}`);
    console.log(`${colors.green}  - IP-based blocking from your host provider${colors.reset}`);
    console.log(`${colors.green}  - Anti-bot measures from WhatsApp${colors.reset}`);
  } else if (percentage >= 60) {
    console.log(`\n${colors.yellow}⚠️ Some checks passed, but issues were detected.${colors.reset}`);
    
    if (!authState) console.log(`${colors.yellow}  - No auth state found. You will need to scan a new QR code.${colors.reset}`);
    if (!network) console.log(`${colors.yellow}  - Network connectivity issues detected. Check your internet connection.${colors.reset}`);
    if (!errors) console.log(`${colors.yellow}  - Recent connection errors found. Check the logs for details.${colors.reset}`);
    if (!dependencies) console.log(`${colors.yellow}  - Dependencies may be missing or outdated. Run npm install.${colors.reset}`);
    if (!methods) console.log(`${colors.yellow}  - Connection methods are not properly configured. Check your files.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ Several checks failed. Your system has significant issues.${colors.reset}`);
    
    if (!authState) console.log(`${colors.red}  - No auth state found. You will need to scan a new QR code.${colors.reset}`);
    if (!network) console.log(`${colors.red}  - Network connectivity issues detected. Check your internet connection.${colors.reset}`);
    if (!errors) console.log(`${colors.red}  - Recent connection errors found. Check the logs for details.${colors.reset}`);
    if (!dependencies) console.log(`${colors.red}  - Dependencies may be missing or outdated. Run npm install.${colors.reset}`);
    if (!methods) console.log(`${colors.red}  - Connection methods are not properly configured. Check your files.${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Recommended actions:${colors.reset}`);
  
  if (!authState) {
    console.log(`${colors.cyan}1. Try running node run-connection.js to select a connection method${colors.reset}`);
  } else if (!network) {
    console.log(`${colors.cyan}1. Check your network connection and firewall settings${colors.reset}`);
  } else if (!errors) {
    console.log(`${colors.cyan}1. Review CONNECTION_FIXES.md for solutions to common errors${colors.reset}`);
  } else if (!dependencies) {
    console.log(`${colors.cyan}1. Run npm install to ensure all dependencies are installed${colors.reset}`);
  } else if (!methods) {
    console.log(`${colors.cyan}1. Reinstall the project or restore missing connection method files${colors.reset}`);
  } else {
    console.log(`${colors.cyan}1. Try using node src/terminal-qr.js for the most reliable connection${colors.reset}`);
  }
  
  console.log(`${colors.cyan}2. Consult CONNECTION_README.md for detailed troubleshooting steps${colors.reset}`);
  console.log(`${colors.cyan}3. If the issue persists, try connecting at a different time or from a different network${colors.reset}`);
}

// Main function
async function main() {
  try {
    // Run all checks
    const authStateResult = checkAuthState();
    const networkResult = await checkNetworkConnectivity();
    const errorsResult = checkConnectionErrors();
    const dependenciesResult = checkDependencies();
    const methodsResult = checkConnectionMethods();
    
    // Generate diagnosis
    generateDiagnosis({
      authState: authStateResult,
      network: networkResult,
      errors: errorsResult,
      dependencies: dependenciesResult,
      methods: methodsResult
    });
    
  } catch (error) {
    console.log(`\n${colors.red}Critical error during diagnostics: ${error.message}${colors.reset}`);
    console.log(`\n${colors.yellow}Recommendation: Run npm install and check your project configuration${colors.reset}`);
  }
}

// Run the diagnostics
main();