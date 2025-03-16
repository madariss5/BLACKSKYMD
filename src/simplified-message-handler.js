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
 * Execute commands with enhanced error handling
 * @param {Function} handler - Command handler function
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {Array} args - Command arguments
 */
async function executeCommand(handler, sock, msg, args) {
    try {
        console.log(`Starting command execution with args: ${JSON.stringify(args)}`);
        
        // Check if handler is a valid function
        if (typeof handler !== 'function') {
            throw new Error('Command handler is not a function');
        }
        
        // Check if message has a valid remoteJid
        if (!msg.key || !msg.key.remoteJid) {
            throw new Error('Invalid message object: missing remoteJid');
        }
        
        // Execute the command handler
        console.log('Calling command handler...');
        await handler(sock, msg, args);
        console.log('Command executed successfully');
        
    } catch (err) {
        console.error(`Error executing command: ${err.message}`);
        console.error(err.stack);
        
        // Send error message to user
        try {
            const jid = msg.key.remoteJid;
            console.log(`Sending error message to ${jid}`);
            
            // Send a user-friendly error message
            await sock.sendMessage(jid, { 
                text: `Sorry, there was an error executing the command: ${err.message}\n\nPlease try again later.`
            });
            
            console.log('Error message sent to user');
        } catch (sendError) {
            console.error(`Failed to send error message: ${sendError.message}`);
            console.error(sendError.stack);
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
    
    // Register message handler with better debugging
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            console.log(`\n==== RECEIVED MESSAGE UPDATE ====`);
            console.log(`Update type: ${type}`);
            console.log(`Has messages: ${messages && messages.length > 0 ? 'Yes' : 'No'}`);
            
            // Check if we actually have messages
            if (!messages || !messages[0]) {
                console.log('No messages found in the update');
                return;
            }
            
            // Get the first message
            const msg = messages[0];
            const remoteJid = msg.key?.remoteJid || 'unknown';
            console.log(`Message from: ${remoteJid}`);
            
            // Dump message structure for debugging
            console.log(`Message structure: ${JSON.stringify(msg.key)}`);
            
            // Skip empty messages and status updates
            if (!msg.message) {
                console.log('Message content is empty');
                return;
            }
            
            // We're commenting this out to process ALL messages
            // The bot can now respond to its own messages too (for testing purposes)
            // if (msg.key.fromMe) {
            //     console.log('Message is from me (the bot), logging but processing anyway');
            //     // Don't return - we want to process messages from self too
            // }
            
            if (remoteJid === 'status@broadcast') {
                console.log('Message is a status update, ignoring');
                return;
            }
            
            // Get message text from different types of messages
            const messageText = msg.message.conversation || 
                               (msg.message.extendedTextMessage && 
                                msg.message.extendedTextMessage.text) || '';
            
            console.log(`Message text: "${messageText}"`);
            
            // Check for commands (starts with !)
            if (messageText.startsWith('!')) {
                const [commandName, ...args] = messageText.slice(1).trim().split(' ');
                const command = commandName.toLowerCase();
                
                console.log(`==== COMMAND DETECTED ====`);
                console.log(`Command: ${command}`);
                console.log(`Arguments: ${args.join(' ')}`);
                
                try {
                    // Load the safe-send utility for reliable message sending
                    let safeSend;
                    try {
                        // First try the direct path
                        safeSend = require('./utils/safe-send');
                        console.log('Successfully loaded safe-send utility');
                    } catch (err) {
                        try {
                            // Try alternate path
                            safeSend = require('../src/utils/safe-send');
                            console.log('Successfully loaded safe-send utility (alternate path)');
                        } catch (altErr) {
                            console.log(`Could not load safe-send utility: ${err.message}`);
                            // Fallback to direct sending
                            safeSend = {
                                safeSendText: async (sock, jid, text) => {
                                    console.log(`[DIRECT SEND] Sending text to ${jid}`);
                                    return sock.sendMessage(jid, { text });
                                }
                            };
                            console.log('Using direct message sending (safe-send.js not available)');
                        }
                    }
                    
                    // Comment out the acknowledgment message to reduce chat clutter
                    // await safeSend.safeSendText(sock, remoteJid, `Processing command: ${command}...`);
                    console.log(`Skipping acknowledgment message for cleaner chat experience`);
                    
                    // Execute command if it exists
                    if (commandHandlers.has(command)) {
                        console.log(`Command handler found, executing: ${command}`);
                        const { handler } = commandHandlers.get(command);
                        await executeCommand(handler, sock, msg, args);
                        console.log(`Command execution completed for: ${command}`);
                    } else {
                        console.log(`Command not found: ${command}`);
                        // Send a message saying the command wasn't found
                        await safeSend.safeSendText(sock, remoteJid, 
                            `Command '${command}' not found. Type !help to see available commands.`
                        );
                    }
                } catch (cmdErr) {
                    console.error(`===== CRITICAL ERROR IN COMMAND PROCESSING =====`);
                    console.error(`Error: ${cmdErr.message}`);
                    console.error(cmdErr.stack);
                    
                    // Last resort attempt to send error message directly
                    try {
                        await sock.sendMessage(remoteJid, { 
                            text: `Sorry, there was an error processing the command. Please try again.` 
                        });
                    } catch (finalErr) {
                        console.error(`Failed to send error message: ${finalErr.message}`);
                    }
                }
            } else {
                console.log('Message is not a command');
                // DO NOT respond to non-command messages to avoid rate limiting
                // WhatsApp is blocking us with 429 errors because we're sending too many messages
                // We'll only respond to actual commands
            }
            
            console.log(`==== MESSAGE PROCESSING COMPLETE ====\n`);
        } catch (error) {
            console.error(`FATAL ERROR in message handler: ${error.message}`);
            console.error(error.stack);
            
            // Try to notify about the error
            try {
                if (messages && messages[0] && messages[0].key && messages[0].key.remoteJid) {
                    await sock.sendMessage(messages[0].key.remoteJid, { 
                        text: `Sorry, there was an error processing your message. The bot is still running.` 
                    });
                }
            } catch (notifyErr) {
                console.error(`Could not send error notification: ${notifyErr.message}`);
            }
        }
    });
    
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