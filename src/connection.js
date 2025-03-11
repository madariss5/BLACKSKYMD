const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { messageHandler } = require('./handlers/messageHandler');
const { commandLoader } = require('./utils/commandLoader');
const handleGroupMessage = require('./handlers/groupMessageHandler');
const handleGroupParticipantsUpdate = require('./handlers/groupParticipantHandler');
const { sessionManager } = require('./utils/sessionManager');

let sock = null;
let retryCount = 0;
// Set higher retry values for production/Heroku environments
const isProduction = process.env.NODE_ENV === 'production';
const isHeroku = !!process.env.DYNO;

// Configure retry settings based on environment
const MAX_RETRIES = isProduction ? 999999 : 10; // Virtually unlimited retries in production
const RETRY_INTERVAL_BASE = isProduction ? 5000 : 10000; // Faster initial retry in production
const MAX_RETRY_INTERVAL = isProduction ? 300000 : 60000; // Max 5 minutes between retries in production
const STREAM_ERROR_COOLDOWN = isProduction ? 30000 : 15000; // Longer cooldown for stream errors in production
const RESTART_COOLDOWN = isProduction ? 60000 : 30000; // Cooldown period before full restart
const MAX_STREAM_ATTEMPTS = isProduction ? 20 : 10; // More stream retry attempts in production

// Auth directory setup - accommodate Heroku's ephemeral filesystem
const AUTH_DIR = path.join(process.cwd(), 'auth_info');

// Connection state tracking
let isConnected = false;
let qrDisplayed = false;
let connectionAttempts = 0;
let streamRetryCount = 0;
let lastRestartTime = 0; // Track last restart time
let lastLogTime = 0; // Rate limit repeated log messages

// Credentials tracking to prevent spamming
let initialCredsSent = false;
let lastCredsSentTime = 0;
const CREDS_SEND_COOLDOWN = 300000; // 5 minutes cooldown between credential sends

async function validateSession() {
    try {
        const credentialsPath = path.join(AUTH_DIR, 'creds.json');
        let exists = await fs.access(credentialsPath)
            .then(() => true)
            .catch(() => false);

        // If we're on Heroku and credentials don't exist, try to restore from backup
        if (!exists && isHeroku) {
            logger.info('Running on Heroku with no credentials file - attempting restore from backup');
            const restored = await sessionManager.restoreFromBackup();
            if (restored) {
                logger.info('Successfully restored credentials from backup');
                exists = true;
            } else {
                logger.warn('Could not restore credentials from backup, will need to scan QR code');
            }
        }

        if (!exists) return false;

        const creds = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
        const valid = !!creds?.me?.id;
        
        if (valid) {
            logger.info('Session validated successfully');
            
            // On Heroku, make a backup after successful validation
            if (isHeroku) {
                try {
                    logger.info('Creating post-validation backup on Heroku');
                    await sessionManager.backupCredentials();
                } catch (backupErr) {
                    logger.error('Error creating post-validation backup:', backupErr);
                }
            }
        }
        
        return valid;
    } catch (err) {
        logger.error('Session validation error:', err);
        return false;
    }
}

async function cleanAuthState() {
    try {
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
        await fs.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
        logger.error('Clean auth state error:', err);
    }
}

async function handleStreamError(error, sock) {
    logger.error('Stream error encountered:', error);
    streamRetryCount++;

    if (streamRetryCount <= MAX_STREAM_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, streamRetryCount - 1), 30000);
        logger.info(`Attempting stream recovery (${streamRetryCount}/${MAX_STREAM_ATTEMPTS}) in ${delay/1000}s`);

        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    await sock.ws.close();
                    await sock.ws.connect();
                    streamRetryCount = 0;
                    logger.info('Stream reconnected successfully');
                    resolve(true);
                } catch (err) {
                    logger.error('Stream reconnection failed:', err);
                    resolve(false);
                }
            }, delay);
        });
    }
    return false;
}

async function startConnection() {
    try {
        await commandLoader.loadCommandHandlers();
        await fs.mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });

        const { version } = await fetchLatestBaileysVersion();
        const isValidSession = await validateSession();

        if (!isValidSession && retryCount > 0) {
            await cleanAuthState();
        }

        let state, saveCreds;
        try {
            const auth = await useMultiFileAuthState(AUTH_DIR);
            state = auth.state;
            saveCreds = auth.saveCreds;
        } catch (authErr) {
            logger.error('Auth state error:', authErr);
            await cleanAuthState();
            const auth = await useMultiFileAuthState(AUTH_DIR);
            state = auth.state;
            saveCreds = auth.saveCreds;
        }

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: logger,
            browser: ['WhatsApp-MD', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            qrTimeout: 40000,
            defaultQueryTimeoutMs: 10000, // Reduced for faster operations
            keepAliveIntervalMs: 10000, // Reduced for more frequent keepalive
            retryRequestDelayMs: 1000, // Reduced for faster retries
            emitOwnEvents: true,
            maxRetries: 10, // Increased retries
            markOnlineOnConnect: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: false, // Set to false for faster operation
            syncFullHistory: false,
            msgRetryCounterCache: {
                max: 2000, // Increased cache size
                ttl: 120000 // Increased time-to-live
            },
            patchMessageBeforeSending: (message) => {
                return message;
            },
            options: {
                timeout: 20000, // Reduced timeout
                noAckTimeout: 30000, // Reduced noAck timeout
                retryOnNetworkError: true,
                retryOnStreamError: true,
                maxRetryAttempts: 10 // Increased retry attempts
            },
            getMessage: async (key) => {
                try {
                    return await sock.store.loadMessage(key.remoteJid, key.id);
                } catch (err) {
                    logger.error('Error getting message:', err);
                    return null;
                }
            }
        });

        if (sock.ws) {
            sock.ws.on('error', async (err) => {
                logger.error('WebSocket error:', err);
                if (err.code === 515) {
                    const recovered = await handleStreamError(err, sock);
                    if (!recovered && isConnected) {
                        logger.error('Stream recovery failed, attempting full reconnect');
                        isConnected = false;
                        startConnection();
                    }
                }
            });

            sock.ws.on('close', () => {
                logger.info('WebSocket closed');
                if (isConnected) {
                    isConnected = false;
                    startConnection();
                }
            });
        }

        sock.ev.process(async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect, qr } = update;

                if (qr && !qrDisplayed) {
                    qrDisplayed = true;
                    process.stdout.write('\x1Bc');
                    qrcode.generate(qr, {
                        small: true,
                        scale: 1
                    }, (qrcode) => {
                        console.log(qrcode);
                    });
                    console.log('📱 Scan the QR code above with WhatsApp to start the bot');
                    console.log('⏳ QR code will refresh in 60 seconds if not scanned\n');
                }

                if (connection === 'open' && !isConnected) {
                    isConnected = true;
                    qrDisplayed = false;
                    retryCount = 0;
                    streamRetryCount = 0;
                    process.stdout.write('\x1Bc');
                    console.log('✅ Successfully connected to WhatsApp!\n');

                    try {
                        // Initialize credential tracking
                        initialCredsSent = true;
                        lastCredsSentTime = Date.now();
                        logger.info('Connection initialized and credentials tracking set up');
                        
                        // Try to send a notification to owner if the number is set
                        let ownerNumber = process.env.OWNER_NUMBER;
                        if (!ownerNumber) {
                            logger.warn('OWNER_NUMBER environment variable is not set - skipping notification');
                        } else {
                            try {
                                if (!ownerNumber.includes('@s.whatsapp.net')) {
                                    ownerNumber = ownerNumber.replace(/[^\d]/g, '');
                                    if (!ownerNumber.startsWith('1') && !ownerNumber.startsWith('91')) {
                                        ownerNumber = '1' + ownerNumber;
                                    }
                                    ownerNumber = `${ownerNumber}@s.whatsapp.net`;
                                }

                                await sock.sendMessage(ownerNumber, { text: 'Bot is now connected!' });
                                logger.info('Connection notification sent successfully to: ' + ownerNumber);
                            } catch (notifyErr) {
                                // Don't let this error stop the bot from working
                                logger.error('Failed to send owner notification:', notifyErr.message);
                                logger.info('Bot will continue to operate normally despite notification failure');
                            }
                        }
                    } catch (err) {
                        logger.error('Failed to send connection notification:', err.message);
                    }
                }

                if (connection === 'close') {
                    isConnected = false;
                    qrDisplayed = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                        statusCode !== DisconnectReason.forbidden;

                    logger.info(`Connection closed. Status code: ${statusCode}`);
                    logger.info(`Last disconnect reason: ${JSON.stringify(lastDisconnect?.error || {})}`);

                    // Implement an exponential backoff strategy with different behavior for different environments
                    if (shouldReconnect && retryCount < MAX_RETRIES) {
                        retryCount++;
                        
                        // Calculate delay with exponential backoff but cap at maximum interval
                        const delay = Math.min(
                            RETRY_INTERVAL_BASE * Math.pow(1.5, retryCount - 1), 
                            MAX_RETRY_INTERVAL
                        );
                        
                        // For Heroku, we implement more persistent reconnection behavior
                        if (isHeroku) {
                            // Rate limit logging to avoid log spam
                            const now = Date.now();
                            if (now - lastLogTime > 30000) {
                                lastLogTime = now;
                                logger.info(`🔄 Heroku environment: Reconnection attempt ${retryCount}/${MAX_RETRIES} in ${Math.floor(delay / 1000)} seconds`);
                            }
                            
                            // On Heroku, we'll try more aggressive recovery for specific error codes
                            if (statusCode === DisconnectReason.connectionClosed ||
                                statusCode === DisconnectReason.connectionLost ||
                                statusCode === DisconnectReason.connectionReplaced) {
                                
                                logger.info('Using aggressive recovery for connection issues on Heroku');
                                // Shorter delay for network-related issues
                                setTimeout(startConnection, Math.min(delay, 10000));
                            } else {
                                setTimeout(startConnection, delay);
                            }
                        } else {
                            // Standard environment behavior
                            logger.info(`🔄 Reconnecting in ${Math.floor(delay / 1000)} seconds...`);
                            setTimeout(startConnection, delay);
                        }
                    } else {
                        if (!shouldReconnect) {
                            // Session is no longer valid, clean state and restart
                            console.log('\n❌ Session expired. A new QR code will be generated.\n');
                            await cleanAuthState();
                            startConnection();
                        } else if (isHeroku && retryCount >= MAX_RETRIES) {
                            // For Heroku, we never give up - reset the counter and try again after a longer delay
                            logger.warn(`Hit maximum retry count ${MAX_RETRIES}, but continuing on Heroku with reset counter`);
                            retryCount = Math.floor(MAX_RETRIES / 2); // Reset to half the max to maintain some backoff
                            setTimeout(startConnection, RESTART_COOLDOWN);
                        } else {
                            // Standard environment, maximum retries reached
                            console.log('\n❌ Maximum retry attempts reached. Please restart the bot.\n');
                            process.exit(1);
                        }
                    }
                }
            }

            if (events['creds.update']) {
                await saveCreds();
                
                // When credentials are updated and we're on Heroku, create a backup
                if (isHeroku) {
                    try {
                        logger.info('Credentials updated, creating Heroku backup...');
                        await sessionManager.backupCredentials();
                        
                        // Also create an emergency backup for important credential updates
                        if (events['creds.update'].me) {
                            logger.info('Critical credentials update detected, creating emergency backup');
                            await sessionManager.emergencyCredsSave(events['creds.update']);
                        }
                    } catch (backupErr) {
                        logger.error('Failed to create backup after credentials update:', backupErr);
                    }
                }
                
                // Credential update tracking (disabled sending credentials to bot as it causes spam)
                try {
                    const now = Date.now();
                    
                    // Update timestamp to track when credentials were last updated
                    lastCredsSentTime = now;
                    
                    // Log that credentials were updated but not sent (for security and to avoid spamming)
                    logger.info('Credentials updated - file sending to bot is disabled to prevent spamming');
                } catch (err) {
                    logger.error('Error tracking credential update:', err);
                }
            }

            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        if (!msg.message) continue;
                        try {
                            // Check if message is from a group
                            if (msg.key.remoteJid.endsWith('@g.us')) {
                                await handleGroupMessage(sock, msg);
                            }
                            await messageHandler(sock, msg);
                        } catch (err) {
                            logger.error('Message handling error:', err);
                        }
                    }
                }
            }

            // Handle group participant updates (join/leave events)
            if (events['group-participants.update']) {
                const update = events['group-participants.update'];
                try {
                    await handleGroupParticipantsUpdate(sock, update);
                } catch (err) {
                    logger.error('Group participants update error:', err);
                }
            }
        });

        const cleanup = async (signal) => {
            if (sock) {
                try {
                    logger.info(`Received ${signal}, cleaning up...`);
                    
                    // On Heroku, try to create a final backup before shutting down
                    if (isHeroku && isConnected) {
                        try {
                            logger.info('Creating final backup before shutdown...');
                            await sessionManager.backupCredentials();
                            logger.info('Final backup completed');
                        } catch (backupErr) {
                            logger.error('Final backup failed:', backupErr);
                        }
                    }
                    
                    // Perform normal cleanup
                    await sock.logout();
                    await sock.end();
                    
                    // Only clean auth state if not on Heroku (preserve files for backup)
                    if (!isHeroku) {
                        await cleanAuthState();
                    }
                    
                    logger.info('Cleanup completed');
                } catch (err) {
                    logger.error('Cleanup error:', err);
                }
            }
            process.exit(0);
        };

        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('SIGINT', () => cleanup('SIGINT'));

        return sock;
    } catch (err) {
        logger.error('Connection error:', err);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            // Calculate delay with exponential backoff but cap at maximum interval
            const delay = Math.min(
                RETRY_INTERVAL_BASE * Math.pow(1.5, retryCount - 1), 
                MAX_RETRY_INTERVAL
            );
            
            if (isHeroku) {
                // Rate limit logging and use more persistent retries on Heroku
                const now = Date.now();
                if (now - lastLogTime > 30000) {
                    lastLogTime = now;
                    logger.info(`🔄 Heroku environment: Recovery attempt ${retryCount}/${MAX_RETRIES} in ${Math.floor(delay / 1000)} seconds`);
                }
                setTimeout(startConnection, delay);
            } else {
                logger.warn(`Connection attempt failed (${retryCount}/${MAX_RETRIES}), retrying in ${Math.floor(delay / 1000)} seconds...`);
                setTimeout(startConnection, delay);
            }
        } else if (isHeroku) {
            // On Heroku, we reset counter instead of giving up
            logger.warn('Maximum retry attempts reached, but continuing on Heroku with reset counter');
            retryCount = Math.floor(MAX_RETRIES / 2); // Reset to half the max
            setTimeout(startConnection, RESTART_COOLDOWN);
        } else {
            throw err;
        }
    }
}

module.exports = { startConnection };