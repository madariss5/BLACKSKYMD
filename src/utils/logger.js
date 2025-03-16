/**
 * Simple Logger Utility for BLACKSKY-MD
 * Provides standardized logging across the application
 */

// Define log levels
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Current log level (can be changed at runtime)
let currentLogLevel = LOG_LEVELS.INFO;

// Log to file flag
let logToFile = false;
let logFilePath = './logs/bot.log';

// Function to format current timestamp
function getTimestamp() {
    return new Date().toISOString();
}

// Create formatted log message
function formatLogMessage(level, message, ...args) {
    const timestamp = getTimestamp();
    let formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Add any additional arguments
    if (args && args.length > 0) {
        args.forEach(arg => {
            if (typeof arg === 'object') {
                try {
                    formattedMessage += ' ' + JSON.stringify(arg);
                } catch (err) {
                    formattedMessage += ' [Object]';
                }
            } else {
                formattedMessage += ' ' + arg;
            }
        });
    }
    
    return formattedMessage;
}

// Write log to file if enabled
function writeToLogFile(message) {
    if (!logToFile) return;
    
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure the log directory exists
        const dir = path.dirname(logFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Append to log file
        fs.appendFileSync(logFilePath, message + '\n');
    } catch (err) {
        console.error('Error writing to log file:', err.message);
    }
}

// Logger object with methods for each log level
const logger = {
    debug(message, ...args) {
        if (currentLogLevel <= LOG_LEVELS.DEBUG) {
            const logMessage = formatLogMessage('DEBUG', message, ...args);
            console.debug(logMessage);
            writeToLogFile(logMessage);
        }
    },
    
    info(message, ...args) {
        if (currentLogLevel <= LOG_LEVELS.INFO) {
            const logMessage = formatLogMessage('INFO', message, ...args);
            console.info(logMessage);
            writeToLogFile(logMessage);
        }
    },
    
    warn(message, ...args) {
        if (currentLogLevel <= LOG_LEVELS.WARN) {
            const logMessage = formatLogMessage('WARN', message, ...args);
            console.warn(logMessage);
            writeToLogFile(logMessage);
        }
    },
    
    error(message, ...args) {
        if (currentLogLevel <= LOG_LEVELS.ERROR) {
            const logMessage = formatLogMessage('ERROR', message, ...args);
            console.error(logMessage);
            writeToLogFile(logMessage);
        }
    },
    
    // Set current log level
    setLogLevel(level) {
        if (level in LOG_LEVELS) {
            currentLogLevel = LOG_LEVELS[level];
        } else if (typeof level === 'number' && level >= 0 && level <= 3) {
            currentLogLevel = level;
        }
    },
    
    // Enable or disable file logging
    enableFileLogging(enable = true, filePath = null) {
        logToFile = enable;
        if (filePath) {
            logFilePath = filePath;
        }
    }
};

module.exports = logger;