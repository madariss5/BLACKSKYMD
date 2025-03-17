/**
 * Terminal QR Connect
 * Enhanced script to connect to WhatsApp via QR code in the terminal
 * With improved session management and error recovery
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Constants
const AUTH_FOLDER = './auth_info_baileys';
const BACKUP_FOLDER = './auth_info_baileys_backup';

// Ensure directories exist
function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        print(`Created directory: ${dir}`, 'info');
    }
}

// Logger setup
const logger = pino({ 
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: true
        }
    }
});

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Ask user a question and get response
function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Print colored output
function print(message, type = 'info') {
    const colors = {
        info: '\x1b[36m%s\x1b[0m',    // Cyan
        success: '\x1b[32m%s\x1b[0m', // Green
        warning: '\x1b[33m%s\x1b[0m', // Yellow
        error: '\x1b[31m%s\x1b[0m',   // Red
        highlight: '\x1b[35m%s\x1b[0m' // Purple
    };
    
    console.log(colors[type] || colors.info, message);
}

// Create a backup of the auth folder
async function backupAuthFolder() {
    try {
        const timestamp = Date.now();
        const backupDir = path.join(BACKUP_FOLDER, `backup_${timestamp}`);
        
        // Create backup directory
        ensureDirectoryExists(backupDir);
        
        // Get all files in auth folder
        const files = fs.readdirSync(AUTH_FOLDER);
        let copiedFiles = 0;
        const checksums = {};
        
        // Copy each file and calculate checksums
        for (const file of files) {
            if (file === '.DS_Store' || file === 'Thumbs.db') continue;
            
            const srcPath = path.join(AUTH_FOLDER, file);
            const destPath = path.join(backupDir, file);
            
            // Skip directories
            if (fs.statSync(srcPath).isDirectory()) continue;
            
            // Copy file
            fs.copyFileSync(srcPath, destPath);
            copiedFiles++;
            
            // Calculate checksum
            const fileBuffer = fs.readFileSync(srcPath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            checksums[file] = hashSum.digest('hex');
        }
        
        // Create checksums file
        if (copiedFiles > 0) {
            const checksumPath = path.join(backupDir, 'checksums.json');
            fs.writeFileSync(checksumPath, JSON.stringify(checksums, null, 2));
            
            print(`Backup created successfully (${copiedFiles} files) at ${backupDir}`, 'success');
            return true;
        } else {
            print('No files were backed up', 'warning');
            try {
                fs.rmdirSync(backupDir);
            } catch (e) {
                // Ignore error
            }
            return false;
        }
    } catch (error) {
        print(`Error backing up auth folder: ${error.message}`, 'error');
        return false;
    }
}

// Main function
async function connectWithQR() {
    print('┌───────────────────────────────────────┐', 'highlight');
    print('│      BLACKSKY-MD TERMINAL QR CONNECT      │', 'highlight');
    print('└───────────────────────────────────────┘\n', 'highlight');
    
    // Ensure directories exist
    ensureDirectoryExists(AUTH_FOLDER);
    ensureDirectoryExists(BACKUP_FOLDER);
    
    try {
        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion();
        print(`Using Baileys version: ${version.join('.')}`, 'info');
        
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        
        // Check if we have existing credentials
        const hasExistingSession = fs.existsSync(path.join(AUTH_FOLDER, 'creds.json'));
        if (hasExistingSession) {
            print('Found existing session credentials', 'info');
            
            // Create a backup before connecting
            await backupAuthFolder();
        } else {
            print('No existing session found. A new QR code will be generated.', 'info');
        }
        
        // Create WhatsApp connection
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['BLACKSKY-MD Terminal', 'Chrome', '4.0.0']
        });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                print('\nQR Code received! Scan this QR code with your WhatsApp app:\n', 'highlight');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                
                print(`Connection closed due to: ${errorMessage} (Code: ${statusCode || 'unknown'})`, 'warning');
                
                const shouldReconnect = lastDisconnect?.error instanceof Boom && 
                    statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    print('Attempting to reconnect...', 'info');
                    
                    // Implement a simple delay and retry
                    setTimeout(() => {
                        print('Reconnecting now...', 'info');
                        connectWithQR().catch(err => {
                            print(`Reconnection error: ${err.message}`, 'error');
                        });
                    }, 3000);
                } else {
                    if (statusCode === DisconnectReason.loggedOut) {
                        print('Device logged out. Please scan a new QR code.', 'error');
                        
                        // Optionally: delete credentials to force new login
                        const credsPath = path.join(AUTH_FOLDER, 'creds.json');
                        if (fs.existsSync(credsPath)) {
                            fs.unlinkSync(credsPath);
                            print('Removed old credentials. Please restart this script.', 'info');
                        }
                    }
                    
                    print('Connection closed permanently. Press Ctrl+C to exit.', 'error');
                }
            } else if (connection === 'open') {
                print('\n┌───────────────────────────────────┐', 'success');
                print('│      CONNECTION SUCCESSFUL      │', 'success');
                print('└───────────────────────────────────┘\n', 'success');
                
                print('✓ Connected successfully', 'success');
                print('✓ Auth credentials saved', 'success');
                print('✓ WhatsApp connection is active', 'success');
                
                // Create a backup after successful connection
                await backupAuthFolder();
                
                print('\nYou can now close this terminal and start the bot.', 'highlight');
                print('Press Ctrl+C to exit.\n', 'highlight');
            }
        });
        
        // Save credentials on update
        sock.ev.on('creds.update', async (creds) => {
            await saveCreds();
            print('Credentials updated and saved', 'info');
        });
        
        return sock;
    } catch (error) {
        print(`Error connecting to WhatsApp: ${error.message}`, 'error');
        print('\nTroubleshooting tips:', 'info');
        print('1. Make sure your internet connection is stable', 'info');
        print('2. Check if your WhatsApp is up to date', 'info');
        print('3. Try restarting this script', 'info');
        print('4. If problem persists, delete the auth_info_baileys folder and try again', 'info');
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    print('\nReceived SIGINT, shutting down...', 'info');
    rl.close();
    process.exit(0);
});

// Start connection
connectWithQR().catch(err => {
    print(`Fatal error: ${err.message}`, 'error');
    process.exit(1);
});