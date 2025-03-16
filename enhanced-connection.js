/**
 * Enhanced Connection Script for WhatsApp Bot
 * Automatically tries different browser fingerprints and connection methods
 * to maximize connection success rate in cloud environments
 */

const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

// Configuration
const MAX_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds
const CONNECTION_METHODS = [
    { name: 'Safari', script: 'safari-connect.js', browser: ['Safari', 'MacOS', '10.15.7'] },
    { name: 'Firefox', script: 'firefox-connect.js', browser: ['Firefox', 'Linux', '20.0.1'] },
    { name: 'Chrome', script: 'src/terminal-qr.js', browser: ['Chrome', 'Windows', '10.0.0'] },
    { name: 'Edge', script: 'src/qr-web-server.js', browser: ['Edge', 'Windows', '18.19041'] }
];

let currentMethodIndex = 0;
let attempts = 0;

console.log(`
╭───────────────────────────────────────────────╮
│                                               │
│     Enhanced WhatsApp Connection System       │
│     Auto-tries various connection methods     │
│                                               │
│     • Rotates between browser fingerprints    │
│     • Auto-retries on connection failure      │
│     • Manages credentials between attempts    │
│                                               │
╰───────────────────────────────────────────────╯
`);

// Ensure logs directory exists
if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
}

// Create a write stream for logging
const logStream = fs.createWriteStream('./logs/enhanced-connection.log', { flags: 'a' });

// Function to log messages
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
}

// Try the next connection method
function tryNextMethod() {
    if (currentMethodIndex >= CONNECTION_METHODS.length) {
        currentMethodIndex = 0;
        attempts++;
        
        if (attempts >= MAX_ATTEMPTS) {
            log('All connection methods tried without success after maximum attempts');
            log('Please try again later or check your internet connection');
            log('Suggestions:');
            log('1. Try connecting using a different network');
            log('2. Use a VPN if possible');
            log('3. See CONNECTION_README.md for advanced troubleshooting');
            process.exit(1);
        }
    }
    
    const method = CONNECTION_METHODS[currentMethodIndex];
    log(`Trying connection method ${currentMethodIndex + 1}/${CONNECTION_METHODS.length}: ${method.name}`);
    log(`Using browser fingerprint: ${method.browser.join(', ')}`);
    
    // Start the connection script as a child process
    const child = exec(`node ${method.script}`, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
    
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    
    child.on('exit', (code) => {
        // Exit code 2 means "try next method"
        if (code === 2) {
            log(`Connection method ${method.name} failed, trying next method...`);
            currentMethodIndex++;
            setTimeout(tryNextMethod, RETRY_DELAY);
        } else if (code !== 0) {
            log(`Connection method ${method.name} exited with code ${code}`);
            currentMethodIndex++;
            setTimeout(tryNextMethod, RETRY_DELAY);
        }
        // If exit code is 0, connection was successful
    });
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
        child.kill();
        log('Process terminated by user');
        process.exit(0);
    });
}

// First check if auth files exist
function checkAuthFiles() {
    const authDirs = [
        './auth_info_baileys',
        './auth_info_safari',
        './auth_info_firefox',
        './auth_info_terminal',
        './auth_info_qr'
    ];
    
    for (const dir of authDirs) {
        if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
            log(`Found existing auth files in ${dir}`);
            log('Attempting to use existing credentials');
            
            // Start with the normal QR web server which will use existing credentials
            const method = { name: 'Default (with existing credentials)', script: 'src/qr-web-server.js' };
            
            log(`Starting connection with existing credentials: ${method.name}`);
            
            const child = exec(`node ${method.script}`, { maxBuffer: 1024 * 1024 * 10 });
            
            child.stdout.pipe(process.stdout);
            child.stderr.pipe(process.stderr);
            
            child.on('exit', (code) => {
                if (code !== 0) {
                    log('Failed to connect with existing credentials, trying new connection methods...');
                    setTimeout(tryNextMethod, RETRY_DELAY);
                }
            });
            
            return true;
        }
    }
    
    return false;
}

// Start the connection process
if (!checkAuthFiles()) {
    log('No existing auth files found, starting with new connection');
    tryNextMethod();
}

// Create an interface to read from the console
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Listen for 'r' key press to retry with a different method
rl.on('line', (input) => {
    if (input.toLowerCase() === 'r') {
        log('Manual retry requested');
        currentMethodIndex++;
        tryNextMethod();
    } else if (input.toLowerCase() === 'q') {
        log('Quit requested by user');
        process.exit(0);
    }
});

console.log('\nPress "r" at any time to try a different connection method');
console.log('Press "q" to quit the script\n');