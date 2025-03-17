/**
 * Enhanced Message Handler for WhatsApp Bot
 * Provides a streamlined message handling system with dynamic command loading
 */

const fs = require('fs');
const path = require('path');

// Track initialization
let initialized = false;
const commandHandlers = new Map();

/**
 * Try to load command modules from the standard structure
 * @param {Object} sock - WhatsApp socket connection  
 */
async function loadCommandModules(sock) {
    try {
        // Default basic commands if we can't load modules
        const basicCommands = {
            'ping': async (sock, msg) => {
                const jid = msg.key.remoteJid;
                await sock.sendMessage(jid, { text: 'Pong! 🏓' });
            },
            'help': async (sock, msg) => {
                const jid = msg.key.remoteJid;
                let helpText = '*Available Commands*\n\n';
                
                // Add all registered commands to help text
                commandHandlers.forEach((handler, cmd) => {
                    helpText += `!${cmd} - ${handler.description || 'No description'}\n`;
                });
                
                await sock.sendMessage(jid, { text: helpText });
            },
            'echo': async (sock, msg, args) => {
                const jid = msg.key.remoteJid;
                const text = args.join(' ');
                await sock.sendMessage(jid, { text: text || 'You need to provide text to echo!' });
            }
        };
        
        // Register basic commands
        Object.entries(basicCommands).forEach(([name, handler]) => {
            commandHandlers.set(name, { 
                handler: handler,
                description: name === 'ping' ? 'Check if bot is active' : 
                            name === 'help' ? 'Display all available commands' :
                            name === 'echo' ? 'Repeat your message back to you' : 'No description'
            });
        });
        
        // Try to load command modules from both locations
        const commandPaths = [
            path.join(process.cwd(), 'commands'),
            path.join(process.cwd(), 'src', 'commands')
        ];
        
        // Process each command path
        for (const commandsPath of commandPaths) {
            if (fs.existsSync(commandsPath)) {
                try {
                    console.log(`Loading commands from: ${commandsPath}`);
                    const moduleFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                    
                    for (const file of moduleFiles) {
                        try {
                            const filePath = path.join(commandsPath, file);
                            
                            // Skip backup files and templates
                            if (file.includes('.bak') || file.includes('.tmp') || file.startsWith('_')) {
                                continue;
                            }
                            
                            const commandModule = require(filePath);
                            
                            // Support two formats: direct exports or .commands object
                            const commands = commandModule.commands || commandModule;
                            
                            // Skip if not a valid command module
                            if (typeof commands !== 'object') {
                                continue;
                            }
                            
                            // Register each command in the module
                            Object.entries(commands).forEach(([name, handler]) => {
                                if (typeof handler === 'function') {
                                    commandHandlers.set(name, { 
                                        handler: handler,
                                        description: commandModule.descriptions?.[name] || 'No description',
                                        source: commandsPath
                                    });
                                    console.log(`Registered command: ${name}`);
                                } else if (typeof handler === 'object' && typeof handler.execute === 'function') {
                                    commandHandlers.set(name, { 
                                        handler: handler.execute,
                                        description: handler.description || 'No description',
                                        source: commandsPath
                                    });
                                    console.log(`Registered command: ${name}`);
                                }
                            });
                        } catch (err) {
                            console.error(`Error loading command file ${file}: ${err.message}`);
                        }
                    }
                } catch (err) {
                    console.error(`Error reading commands directory: ${err.message}`);
                }
            }
        }
        
        console.log(`Loaded ${commandHandlers.size} commands`);
        return true;
    } catch (err) {
        console.error(`Failed to load command modules: ${err.message}`);
        initializeBasicCommands();
        return false;
    }
}

/**
 * Initialize basic commands as fallback
 */
function initializeBasicCommands() {
    // Simple ping command
    commandHandlers.set('ping', {
        handler: async (sock, msg) => {
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: 'Pong! 🏓' });
        },
        description: 'Check if bot is active'
    });
    
    // Help command
    commandHandlers.set('help', {
        handler: async (sock, msg) => {
            const jid = msg.key.remoteJid;
            let helpText = '*Available Commands*\n\n';
            
            commandHandlers.forEach((handler, cmd) => {
                helpText += `!${cmd} - ${handler.description || 'No description'}\n`;
            });
            
            await sock.sendMessage(jid, { text: helpText });
        },
        description: 'Display all available commands'
    });
    
    console.log('Initialized basic commands as fallback');
}

/**
 * Optimized command execution with minimal overhead
 * @param {Function} handler - Command handler function
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {Array} args - Command arguments
 */
async function executeCommand(handler, sock, msg, args) {
    // Fast path validation with minimal checks
    if (typeof handler !== 'function' || !msg.key?.remoteJid) {
        console.error('Invalid handler or message object');
        return;
    }
    
    try {
        // Minimal logging for better performance
        const startTime = performance.now();
        
        // Execute the command handler without extra wrapping
        await handler(sock, msg, args);
        
        // Performance monitoring for slow commands
        const executionTime = performance.now() - startTime;
        if (executionTime > 500) {
            console.log(`⚠️ Slow command execution: ${executionTime.toFixed(2)}ms`);
        }
    } catch (err) {
        // Simplified error handling - minimize overhead
        const jid = msg.key.remoteJid;
        console.error(`Error executing command: ${err.message}`);
        
        // Send a concise error message
        try {
            await sock.sendMessage(jid, { 
                text: `Command error: ${err.message.slice(0, 100)}`
            }).catch(() => {});
        } catch (e) {
            // Fail silently
        }
    }
}

/**
 * Initialize message handler
 * @param {Object} sock - WhatsApp socket connection
 */
async function init(sock) {
    if (initialized) {
        console.log('Message handler already initialized');
        return;
    }
    
    // Load command modules
    await loadCommandModules(sock);
    
    // Pre-load common utilities to avoid require() calls during message processing
    let safeSendUtility;
    try {
        // First try the direct path - load once at startup
        safeSendUtility = require('./utils/safe-send');
        console.log('Successfully pre-loaded safe-send utility');
    } catch (err) {
        try {
            // Try alternate path
            safeSendUtility = require('../src/utils/safe-send');
            console.log('Successfully pre-loaded safe-send utility (alternate path)');
        } catch (altErr) {
            // Fallback to direct sending
            safeSendUtility = {
                safeSendText: async (sock, jid, text) => {
                    return sock.sendMessage(jid, { text });
                }
            };
            console.log('Created direct message sending utility (safe-send.js not available)');
        }
    }
    
    // Create optimization cache for fast command lookup
    const commandCache = new Map();
    
    // Create queue for message processing with priority
    const messageQueue = [];
    let processingMessage = false;

    // Optimized message handler with reduced logging
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Fast path for most common case
        if (!messages || !messages.length) return;
        
        // Get the first message
        const msg = messages[0];
        if (!msg || !msg.message) return;
        
        // Skip status updates immediately
        const remoteJid = msg.key?.remoteJid || 'unknown';
        if (remoteJid === 'status@broadcast') return;
        
        // Minimal console output for better performance
        console.log(`\n==== RECEIVED MESSAGE UPDATE ====`);
        console.log(`Update type: ${type}`);
        console.log(`Has messages: ${messages.length > 0 ? 'Yes' : 'No'}`);
        console.log(`Message from: ${remoteJid}`);
            
        try {
            // Extract text with fast path for common message types
            const messageText = msg.message.conversation || 
                               (msg.message.extendedTextMessage?.text) || '';
            
            // Fast command detection
            if (messageText.startsWith('!')) {
                console.log(`Message text: "${messageText}"`);
                
                // Parse command with optimized splitting
                const commandEnd = messageText.indexOf(' ') > 0 ? messageText.indexOf(' ') : messageText.length;
                const commandName = messageText.slice(1, commandEnd).toLowerCase();
                const args = commandEnd < messageText.length ? 
                             messageText.slice(commandEnd + 1).trim().split(/\s+/) : [];
                
                console.log(`==== COMMAND DETECTED ====`);
                console.log(`Command: ${commandName}`);
                console.log(`Arguments: ${args.join(' ')}`);
                
                // Use caching for performance
                const safeSend = safeSendUtility;
                
                // Queue command execution 
                messageQueue.push({
                    priority: getCommandPriority(commandName),
                    execute: async () => {
                        try {
                            // Fast path for command execution
                            if (commandHandlers.has(commandName)) {
                                // Get from cache if possible
                                let handlerInfo = commandCache.get(commandName);
                                if (!handlerInfo) {
                                    handlerInfo = commandHandlers.get(commandName);
                                    commandCache.set(commandName, handlerInfo);
                                }
                                
                                const { handler } = handlerInfo;
                                
                                // Start typing indicator for better UX
                                try {
                                    sock.sendPresenceUpdate('composing', remoteJid);
                                } catch (e) {
                                    // Ignore typing errors
                                }
                                
                                // Execute command with optimized error handling
                                await executeCommand(handler, sock, msg, args);
                                console.log(`Command execution completed for: ${commandName}`);
                            } else {
                                // Unknown command - fast response
                                await safeSend.safeSendText(remoteJid, 
                                    `Command '${commandName}' not found. Type !help to see available commands.`
                                );
                            }
                        } catch (err) {
                            console.error(`Error in command execution: ${err.message}`);
                            try {
                                await safeSend.safeSendText(remoteJid, 
                                    `Sorry, there was an error processing the command. Please try again.`
                                );
                            } catch (e) {
                                // Ignore send errors
                            }
                        }
                    }
                });
                
                // Process queue if not already processing
                if (!processingMessage) {
                    processMessageQueue();
                }
            } else {
                console.log('Message is not a command');
            }
            
            console.log(`==== MESSAGE PROCESSING COMPLETE ====\n`);
        } catch (error) {
            console.error(`Error in message handler: ${error.message}`);
            
            // Minimal error recovery - don't block the message handler
            try {
                if (remoteJid && remoteJid !== 'unknown') {
                    sock.sendMessage(remoteJid, { 
                        text: `Sorry, there was an error processing your message. Please try again.` 
                    }).catch(() => {});
                }
            } catch (e) {
                // Ignore notifications errors
            }
        }
    });
    
    // Helper function to assign priority to commands
    function getCommandPriority(command) {
        // Prioritize quick response commands
        const highPriorityCommands = ['ping', 'help', 'status', 'info'];
        return highPriorityCommands.includes(command) ? 1 : 2;
    }
    
    // Process message queue with priority
    async function processMessageQueue() {
        if (messageQueue.length === 0) {
            processingMessage = false;
            return;
        }
        
        processingMessage = true;
        
        // Sort by priority (lower number = higher priority)
        messageQueue.sort((a, b) => a.priority - b.priority);
        
        // Execute next command
        const nextMessage = messageQueue.shift();
        try {
            await nextMessage.execute();
        } catch (err) {
            console.error(`Error processing queued message: ${err.message}`);
        }
        
        // Process next message after a small delay to prevent overloading
        setTimeout(() => processMessageQueue(), 50);
    }
    
    initialized = true;
    console.log('Message handler initialized successfully');
}

/**
 * Check if the handler is initialized
 * @returns {boolean} Whether the handler is initialized
 */
function isInitialized() {
    return initialized;
}

module.exports = {
    init,
    isInitialized
};