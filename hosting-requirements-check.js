/**
 * Hosting Requirements Check Script
 * 
 * This script checks if your system meets the requirements for hosting the WhatsApp bot
 * and provides recommendations for different hosting environments.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Minimum requirements for different hosting options
const requirements = {
  minimal: {
    cpu: 1,
    memory: 512, // MB
    disk: 1, // GB
    nodejs: '16.0.0',
    internet: true
  },
  recommended: {
    cpu: 2,
    memory: 1024, // MB
    disk: 5, // GB
    nodejs: '18.0.0',
    internet: true
  },
  optimal: {
    cpu: 4,
    memory: 2048, // MB
    disk: 10, // GB
    nodejs: '20.0.0',
    internet: true
  }
};

// Function to print a header
function printHeader(text) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${text} ===${colors.reset}\n`);
}

// Function to print a result with colored status
function printResult(test, passed, value = null, recommendation = null) {
  const status = passed 
    ? `${colors.green}✓ PASS${colors.reset}` 
    : `${colors.red}✗ FAIL${colors.reset}`;
  
  let output = `${status} ${test}`;
  if (value !== null) {
    output += `: ${value}`;
  }
  
  console.log(output);
  
  if (!passed && recommendation) {
    console.log(`  ${colors.yellow}Recommendation: ${recommendation}${colors.reset}`);
  }
}

// Function to check system requirements
async function checkSystemRequirements() {
  printHeader('SYSTEM REQUIREMENTS CHECK');
  
  // Check CPU cores
  const cpuCores = os.cpus().length;
  const cpuMinPassed = cpuCores >= requirements.minimal.cpu;
  const cpuRecPassed = cpuCores >= requirements.recommended.cpu;
  const cpuOptPassed = cpuCores >= requirements.optimal.cpu;
  
  printResult(
    'CPU Cores',
    cpuMinPassed,
    `${cpuCores} cores available`,
    cpuMinPassed ? null : 'Minimum 1 CPU core required for basic functionality'
  );
  
  // Check memory
  const totalMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));
  const freeMemoryMB = Math.floor(os.freemem() / (1024 * 1024));
  const memMinPassed = totalMemoryMB >= requirements.minimal.memory;
  const memRecPassed = totalMemoryMB >= requirements.recommended.memory;
  const memOptPassed = totalMemoryMB >= requirements.optimal.memory;
  
  printResult(
    'Memory',
    memMinPassed,
    `${totalMemoryMB} MB total, ${freeMemoryMB} MB free`,
    memMinPassed ? null : `Minimum ${requirements.minimal.memory} MB RAM required`
  );
  
  // Check disk space
  try {
    exec('df -h .', (error, stdout, stderr) => {
      if (error) {
        printResult('Disk Space', false, 'Could not determine disk space');
        return;
      }
      
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const diskInfo = lines[1].split(/\s+/);
        const size = diskInfo[1];
        const used = diskInfo[2];
        const available = diskInfo[3];
        
        printResult('Disk Space', true, `Total: ${size}, Used: ${used}, Available: ${available}`);
      } else {
        printResult('Disk Space', false, 'Could not parse disk information');
      }
    });
  } catch (e) {
    // Fallback for environments where exec might not work
    printResult('Disk Space', true, 'Check skipped (may not be available in this environment)');
  }
  
  // Check Node.js version
  const nodeVersion = process.version.substring(1); // Remove 'v' prefix
  const nodeMinPassed = compareVersions(nodeVersion, requirements.minimal.nodejs) >= 0;
  const nodeRecPassed = compareVersions(nodeVersion, requirements.recommended.nodejs) >= 0;
  const nodeOptPassed = compareVersions(nodeVersion, requirements.optimal.nodejs) >= 0;
  
  printResult(
    'Node.js Version',
    nodeMinPassed,
    nodeVersion,
    nodeMinPassed ? null : `Minimum Node.js ${requirements.minimal.nodejs} required`
  );
  
  // Check internet connectivity
  try {
    await checkInternetConnectivity();
    printResult('Internet Connectivity', true, 'Connected');
  } catch (error) {
    printResult(
      'Internet Connectivity',
      false,
      'Not connected or limited connectivity',
      'Active internet connection required for WhatsApp connection'
    );
  }
}

// Function to check package requirements
function checkPackageRequirements() {
  printHeader('PACKAGE REQUIREMENTS CHECK');
  
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      printResult('package.json', false, 'File not found', 'Run npm init to create a package.json file');
      return;
    }
    
    const packageData = require(packagePath);
    
    // Check for required dependencies
    const requiredDeps = [
      '@whiskeysockets/baileys',
      'qrcode',
      'pino'
    ];
    
    let missingDeps = [];
    for (const dep of requiredDeps) {
      if (!packageData.dependencies || !packageData.dependencies[dep]) {
        missingDeps.push(dep);
      }
    }
    
    if (missingDeps.length === 0) {
      printResult('Required Dependencies', true, 'All core dependencies found');
    } else {
      printResult(
        'Required Dependencies',
        false,
        `Missing: ${missingDeps.join(', ')}`,
        `Run: npm install ${missingDeps.join(' ')}`
      );
    }
    
    // Check for start script
    const hasStartScript = packageData.scripts && packageData.scripts.start;
    printResult(
      'Start Script',
      hasStartScript,
      hasStartScript ? `"${packageData.scripts.start}"` : 'Not defined',
      hasStartScript ? null : 'Add "start": "node src/index.js" to scripts in package.json'
    );
    
  } catch (error) {
    printResult('Package Check', false, `Error: ${error.message}`);
  }
}

// Function to check file structure
function checkFileStructure() {
  printHeader('FILE STRUCTURE CHECK');
  
  // Check for required directories and files
  const requiredFiles = [
    { path: 'src/index.js', name: 'Main Entry Point', critical: true },
    { path: 'src/utils', name: 'Utils Directory', critical: false },
    { path: 'data', name: 'Data Directory', critical: true },
    { path: 'auth_info_baileys', name: 'Auth Info Directory', critical: false }
  ];
  
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(process.cwd(), file.path));
    printResult(
      file.name,
      exists || !file.critical,
      exists ? 'Found' : 'Not found',
      exists || !file.critical ? null : `Create ${file.path} directory/file`
    );
  }
}

// Function to check hosting environment
function checkHostingEnvironment() {
  printHeader('HOSTING ENVIRONMENT DETECTION');
  
  // Check for environment indicators
  const envIndicators = [
    { env: 'Heroku', check: () => !!process.env.DYNO },
    { env: 'DigitalOcean App Platform', check: () => !!process.env.DIGITALOCEAN_APP_ID },
    { env: 'Replit', check: () => !!process.env.REPL_ID || !!process.env.REPL_SLUG },
    { env: 'Glitch', check: () => !!process.env.PROJECT_DOMAIN },
    { env: 'Railway', check: () => !!process.env.RAILWAY_STATIC_URL },
    { env: 'Vercel', check: () => !!process.env.VERCEL },
    { env: 'AWS Lambda', check: () => !!process.env.AWS_LAMBDA_FUNCTION_NAME }
  ];
  
  let detectedEnv = null;
  for (const indicator of envIndicators) {
    try {
      if (indicator.check()) {
        detectedEnv = indicator.env;
        break;
      }
    } catch (e) {
      // Skip if check throws an error
    }
  }
  
  if (detectedEnv) {
    printResult('Environment', true, `Detected: ${detectedEnv}`);
    providePlatformSpecificRecommendations(detectedEnv);
  } else {
    // Try to determine if it's a local environment or VPS
    if (process.env.HOME && (process.env.HOME.includes('/home/') || process.env.HOME.includes('/root/'))) {
      printResult('Environment', true, 'Detected: Linux VPS/Server');
      providePlatformSpecificRecommendations('Linux');
    } else if (process.env.HOMEPATH && process.env.HOMEPATH.includes('\\Users\\')) {
      printResult('Environment', true, 'Detected: Windows Development Environment');
      providePlatformSpecificRecommendations('Windows');
    } else {
      printResult('Environment', true, 'Unknown environment');
      printResult('Recommendation', true, 'See our hosting guides for platform-specific setup instructions');
    }
  }
}

// Function to provide platform-specific recommendations
function providePlatformSpecificRecommendations(platform) {
  console.log(`\n${colors.cyan}${platform}-specific recommendations:${colors.reset}`);
  
  switch (platform) {
    case 'Heroku':
      console.log(`
${colors.yellow}⚠️ Important Heroku Notes:${colors.reset}
1. Use the HEROKU_SETUP_GUIDE.md file for detailed instructions
2. Set up Postgres or Redis for session persistence
3. Create a web server to display the QR code
4. Configure keep-alive to prevent dyno sleeping (free tier)
5. Consider upgrading to Hobby dyno ($7/month) for 24/7 operation`);
      break;
      
    case 'Replit':
      console.log(`
${colors.yellow}⚠️ Important Replit Notes:${colors.reset}
1. Use the "Always On" feature (requires Replit Hacker Plan)
2. Set up a ping server to prevent sleeping
3. Store session data in Replit Database
4. Use .replit file to configure the run command
5. Check compatibility with their new Deployments feature`);
      break;
      
    case 'Linux':
      console.log(`
${colors.green}✓ Linux VPS Recommendations:${colors.reset}
1. Use PM2 to keep your bot running: npm install -g pm2
2. Set up PM2 startup script: pm2 startup
3. Configure regular backups of auth_info_baileys folder
4. Consider using a firewall (ufw) to protect your server
5. Set up automatic updates with a cron job`);
      break;
      
    case 'Windows':
      console.log(`
${colors.yellow}⚠️ Windows Recommendations:${colors.reset}
1. For development only - not recommended for 24/7 hosting
2. Use WSL (Windows Subsystem for Linux) for better compatibility
3. Consider migrating to a VPS for production hosting
4. Use Task Scheduler if you need to automate restarts`);
      break;
      
    default:
      console.log(`
${colors.cyan}General Recommendations:${colors.reset}
1. See our hosting guides for platform-specific instructions
2. Ensure your hosting provider allows WebSocket connections
3. Set up regular backups of your auth_info_baileys folder
4. Configure auto-restart on crash
5. Use environment variables for configuration`);
  }
}

// Function to summarize results
function printSummary() {
  printHeader('SUMMARY AND RECOMMENDATIONS');
  
  // CPU recommendations
  const cpuCores = os.cpus().length;
  if (cpuCores >= requirements.optimal.cpu) {
    console.log(`${colors.green}✓ CPU: Optimal${colors.reset} (${cpuCores} cores) - Can handle many groups and heavy processing`);
  } else if (cpuCores >= requirements.recommended.cpu) {
    console.log(`${colors.green}✓ CPU: Good${colors.reset} (${cpuCores} cores) - Sufficient for most use cases`);
  } else if (cpuCores >= requirements.minimal.cpu) {
    console.log(`${colors.yellow}⚠️ CPU: Minimal${colors.reset} (${cpuCores} cores) - May struggle with high message volume`);
  } else {
    console.log(`${colors.red}✗ CPU: Insufficient${colors.reset} (${cpuCores} cores) - Bot will have performance issues`);
  }
  
  // Memory recommendations
  const totalMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));
  if (totalMemoryMB >= requirements.optimal.memory) {
    console.log(`${colors.green}✓ Memory: Optimal${colors.reset} (${totalMemoryMB} MB) - Can handle media processing and many concurrent users`);
  } else if (totalMemoryMB >= requirements.recommended.memory) {
    console.log(`${colors.green}✓ Memory: Good${colors.reset} (${totalMemoryMB} MB) - Sufficient for normal operation`);
  } else if (totalMemoryMB >= requirements.minimal.memory) {
    console.log(`${colors.yellow}⚠️ Memory: Minimal${colors.reset} (${totalMemoryMB} MB) - May experience occasional crashes under load`);
  } else {
    console.log(`${colors.red}✗ Memory: Insufficient${colors.reset} (${totalMemoryMB} MB) - Bot will crash frequently`);
  }
  
  // Node.js recommendations
  const nodeVersion = process.version.substring(1);
  if (compareVersions(nodeVersion, requirements.optimal.nodejs) >= 0) {
    console.log(`${colors.green}✓ Node.js: Optimal${colors.reset} (${nodeVersion}) - Using recommended version`);
  } else if (compareVersions(nodeVersion, requirements.recommended.nodejs) >= 0) {
    console.log(`${colors.green}✓ Node.js: Good${colors.reset} (${nodeVersion}) - Recent stable version`);
  } else if (compareVersions(nodeVersion, requirements.minimal.nodejs) >= 0) {
    console.log(`${colors.yellow}⚠️ Node.js: Minimal${colors.reset} (${nodeVersion}) - Consider upgrading to a newer version`);
  } else {
    console.log(`${colors.red}✗ Node.js: Outdated${colors.reset} (${nodeVersion}) - Update to at least v${requirements.minimal.nodejs}`);
  }
  
  // Overall recommendation
  console.log('\n📋 Next Steps:');
  console.log('1. Review the hosting guides in this repository for platform-specific setup');
  console.log('2. Set up automated session backups to prevent data loss');
  console.log('3. Configure your bot to auto-restart on crashes');
  console.log('4. Use environment variables for sensitive configuration');
  console.log('5. Test your bot thoroughly before deploying to production');
}

// Helper function to check internet connectivity
function checkInternetConnectivity() {
  return new Promise((resolve, reject) => {
    // Try to connect to Google's DNS
    const req = http.get('http://8.8.8.8', (res) => {
      resolve(true);
    });
    
    req.on('error', (err) => {
      // Try WhatsApp's domain as a fallback
      const req2 = http.get('http://web.whatsapp.com', (res) => {
        resolve(true);
      });
      
      req2.on('error', (err2) => {
        reject(err2);
      });
      
      req2.setTimeout(5000, () => {
        req2.destroy();
        reject(new Error('Connection timeout'));
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}

// Helper function to compare version strings
function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// Main function
async function main() {
  console.log(`${colors.bright}${colors.blue}
╔════════════════════════════════════════════════╗
║  WhatsApp Bot Hosting Requirements Check Tool  ║
║  Version 1.0.0                                 ║
╚════════════════════════════════════════════════╝
${colors.reset}`);
  
  await checkSystemRequirements();
  checkPackageRequirements();
  checkFileStructure();
  checkHostingEnvironment();
  printSummary();
  
  console.log(`\n${colors.bright}${colors.green}Check completed!${colors.reset}`);
}

// Run the main function
main().catch(console.error);