/**
 * Connection Error Handler for WhatsApp Bot
 * Enhanced with persistent session management and reconnection strategies
 */

const logger = require('./logger');
const { safeSendText } = require('./jidHelper');
const fs = require('fs').promises;
const path = require('path');

// Track connection errors with enhanced state management
const connectionErrors = {
    count: 0,
    lastTime: 0,
    reconnectAttempts: 0,
    consecutiveFailures: 0,
    lastErrorType: null,
    lastSuccessfulConnection: 0
};

// Error symptoms that indicate connection issues
const CONNECTION_SYMPTOMS = [
    'connection closed',
    'timed out',
    'network error',
    'invalid message format',
    'disconnected',
    'socket closed',
    'unreachable',
    'connection reset',
    'server returned status code',
    'unable to connect',
    'dns lookup failed',
    'rate limit',
    'unauthorized'
];

// Reconnection configuration
const RECONNECT_CONFIG = {
    baseDelay: 5000,        // Start with 5 seconds
    maxDelay: 300000,       // Max 5 minutes
    maxAttempts: 999999,    // Effectively infinite retries
    backoffFactor: 1.5      // Exponential backoff multiplier
};

/**
 * Check if an error is connection-related
 */
function isConnectionError(error) {
    if (!error) return false;

    const message = (error.message || '').toLowerCase();
    return CONNECTION_SYMPTOMS.some(symptom => message.includes(symptom));
}

/**
 * Calculate reconnection delay with exponential backoff
 */
function calculateReconnectDelay() {
    const attempt = connectionErrors.reconnectAttempts;
    const baseDelay = RECONNECT_CONFIG.baseDelay;
    const maxDelay = RECONNECT_CONFIG.maxDelay;

    const delay = Math.min(
        baseDelay * Math.pow(RECONNECT_CONFIG.backoffFactor, attempt),
        maxDelay
    );

    return Math.floor(delay);
}

/**
 * Log connection error with detailed diagnostics
 */
async function logConnectionError(error, context = 'unknown') {
    const now = Date.now();
    connectionErrors.count++;

    // Calculate time since last error
    const timeSinceLast = connectionErrors.lastTime ? (now - connectionErrors.lastTime) : 0;
    connectionErrors.lastTime = now;

    // Track consecutive failures
    if (timeSinceLast < 60000) { // Less than a minute
        connectionErrors.consecutiveFailures++;
    } else {
        connectionErrors.consecutiveFailures = 1;
    }

    // Save error type
    connectionErrors.lastErrorType = error.message;

    logger.error(`Connection error in ${context}: ${error.message}`, {
        error: error.stack,
        connectionStats: { ...connectionErrors },
        timeSinceLast: `${Math.round(timeSinceLast / 1000)}s`
    });

    // Save detailed diagnostics for severe connection issues
    if (connectionErrors.consecutiveFailures >= 3) {
        await saveConnectionDiagnostics(error, context);
    }
}

/**
 * Save connection diagnostics to a log file
 */
async function saveConnectionDiagnostics(error, context) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logDir = path.join(process.cwd(), 'logs');
        const logFile = path.join(logDir, `connection-error-${timestamp}.log`);

        // Create logs directory if it doesn't exist
        await fs.mkdir(logDir, { recursive: true }).catch(() => {});

        // Gather system information
        const diagnosticInfo = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            connectionStats: { ...connectionErrors },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            }
        };

        await fs.writeFile(
            logFile, 
            JSON.stringify(diagnosticInfo, null, 2), 
            'utf8'
        );

        logger.info(`Connection diagnostics saved to ${logFile}`);
    } catch (saveError) {
        logger.error(`Failed to save connection diagnostics: ${saveError.message}`);
    }
}

/**
 * Handle a connection error with enhanced recovery strategies
 */
async function handleConnectionError(sock, error, context, reconnectFn = null) {
    // Log the error with diagnostics
    await logConnectionError(error, context);

    // Always attempt to reconnect unless explicitly forbidden
    const shouldReconnect = 
        connectionErrors.reconnectAttempts < RECONNECT_CONFIG.maxAttempts && // Not exceeded max attempts
        !!reconnectFn; // Have a reconnect function

    if (shouldReconnect) {
        // Calculate delay with exponential backoff
        const delay = calculateReconnectDelay();

        logger.info(`Scheduling reconnection attempt in ${Math.round(delay/1000)}s...`);

        // Schedule reconnection
        setTimeout(async () => {
            connectionErrors.reconnectAttempts++;
            logger.info(`Attempting reconnection (attempt ${connectionErrors.reconnectAttempts})...`);

            try {
                await reconnectFn();
            } catch (reconnectError) {
                logger.error(`Reconnection attempt failed: ${reconnectError.message}`);
                // The error will be handled by the next iteration
            }
        }, delay);
    }

    // Notify admin of severe connection issues
    if (connectionErrors.consecutiveFailures >= 5 && sock && process.env.ADMIN_NUMBER) {
        try {
            const adminJid = `${process.env.ADMIN_NUMBER.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

            await safeSendText(
                sock, 
                adminJid, 
                `⚠️ *Connection Alert*\n\n` +
                `The bot is experiencing connection issues.\n\n` +
                `*Error:* ${error.message}\n` +
                `*Context:* ${context}\n` +
                `*Consecutive failures:* ${connectionErrors.consecutiveFailures}\n` +
                `*Total errors:* ${connectionErrors.count}\n` +
                `*Last successful connection:* ${new Date(connectionErrors.lastSuccessfulConnection).toLocaleString()}\n\n` +
                `${shouldReconnect ? 'Attempting automatic reconnection...' : 'Please check the bot status.'}`
            );
        } catch (notifyError) {
            logger.error(`Failed to notify admin about connection issues: ${notifyError.message}`);
        }
    }

    return shouldReconnect;
}

/**
 * Reset connection error statistics after successful connection
 */
function resetConnectionStats() {
    connectionErrors.consecutiveFailures = 0;
    connectionErrors.reconnectAttempts = 0;
    connectionErrors.lastSuccessfulConnection = Date.now();
    logger.info('Connection statistics reset after successful connection');
}

module.exports = {
    isConnectionError,
    handleConnectionError,
    logConnectionError,
    resetConnectionStats
};