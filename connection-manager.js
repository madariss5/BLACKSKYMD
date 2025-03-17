/**
 * Advanced WhatsApp Connection Manager
 * Enhanced for 24/7 uptime and stability
 */

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const ConnectionMonitor = require('./src/utils/connectionMonitor');
const pino = require('pino');

// Configuration constants
const BASE_AUTH_FOLDER = './auth_info_manager';
const MAX_QR_ATTEMPTS = 5;
const CONNECTION_TIMEOUT = 60000;
const KEEP_ALIVE_INTERVAL = 10000;

// Memory optimization configuration
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const MEMORY_THRESHOLD = 1.5 * 1024 * 1024 * 1024; // 1.5GB
const MEMORY_CRITICAL = 1.8 * 1024 * 1024 * 1024; // 1.8GB

// Enhanced reconnection backoff configuration
const RECONNECT_BASE_DELAY = 5000; // 5 seconds base delay
const RECONNECT_MAX_DELAY = 300000; // 5 minutes maximum delay
const RECONNECT_JITTER = 0.1; // 10% random jitter

// Rate limit configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes window
const RATE_LIMIT_BASE_DELAY = 60000; // Increased to 1 minute base delay
const RATE_LIMIT_MAX_DELAY = 1800000; // Increased to 30 minutes max delay
const RATE_LIMIT_ATTEMPTS_BEFORE_ROTATE = 2; // Reduced to 2 attempts before rotation
const INITIAL_CONNECTION_DELAY = 30000; // 30 second initial delay

// Add these constants at the top with other constants
const RATE_LIMIT_STATS_FILE = path.join(process.cwd(), 'rate_limit_stats.json');
const PERFORMANCE_DEGRADATION_THRESHOLD = 3; // Number of consecutive rate limits before degrading
const PERFORMANCE_RECOVERY_TIME = 30 * 60 * 1000; // 30 minutes to recover full performance

// Track initialization
let initialized = false;

// Profile tracking
const profileStats = new Map();
// Add rate limit tracking per profile
const profileRateLimitWindows = new Map();

// Profile performance tracking
const PROFILE_STATS_FILE = path.join(process.cwd(), 'profile_stats.json');

// Add these to profileStats structure
const defaultProfileStats = {
    attempts: 0,
    lastAttempt: 0,
    rateLimits: 0,
    successfulConnections: 0,
    consecutiveFailures: 0,
    lastSuccess: 0,
    performance: {
        avgUptime: 0,
        disconnects: 0,
        lastDisconnectReason: null,
        degradedUntil: 0,
        successRate: 1.0,
        avgResponseTime: 0
    }
};

// Enhanced profile stats loading with rate limit persistence
function loadProfileStats() {
    try {
        if (fs.existsSync(RATE_LIMIT_STATS_FILE)) {
            const savedStats = JSON.parse(fs.readFileSync(RATE_LIMIT_STATS_FILE, 'utf8'));
            Object.entries(savedStats).forEach(([name, stats]) => {
                // Merge saved stats with default structure
                profileStats.set(name, {
                    ...defaultProfileStats,
                    ...stats,
                    performance: {
                        ...defaultProfileStats.performance,
                        ...(stats.performance || {})
                    }
                });
                profileRateLimitWindows.set(name, new Map());
            });
            console.log('Loaded existing rate limit statistics');
        }
    } catch (err) {
        console.error('Error loading rate limit stats:', err.message);
    }
}

// Save profile stats periodically
function saveProfileStats() {
    try {
        const statsObj = {};
        profileStats.forEach((stats, name) => {
            statsObj[name] = {
                ...stats,
                lastSaved: Date.now()
            };
        });
        fs.writeFileSync(PROFILE_STATS_FILE, JSON.stringify(statsObj, null, 2));
    } catch (err) {
        console.error('Error saving profile stats:', err.message);
    }
}

// Save rate limit stats periodically and on updates
function saveRateLimitStats() {
    try {
        const statsObj = {};
        profileStats.forEach((stats, name) => {
            statsObj[name] = {
                ...stats,
                lastSaved: Date.now(),
                rateLimitWindows: Array.from(profileRateLimitWindows.get(name).entries())
            };
        });
        fs.writeFileSync(RATE_LIMIT_STATS_FILE, JSON.stringify(statsObj, null, 2));
    } catch (err) {
        console.error('Error saving rate limit stats:', err.message);
    }
}

// Initialize profile tracking
const BROWSER_CONFIGS = [
    {
        name: 'Firefox',
        auth_folder: `${BASE_AUTH_FOLDER}_firefox`,
        fingerprint: ['Firefox', 'Linux', '115.0'],
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0'
    },
    {
        name: 'Chrome',
        auth_folder: `${BASE_AUTH_FOLDER}_chrome`,
        fingerprint: ['Chrome', 'Windows', '120.0.0.0'],
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    {
        name: 'Safari',
        auth_folder: `${BASE_AUTH_FOLDER}_safari`,
        fingerprint: ['Safari', 'Mac OS', '17.0'],
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    }
];

BROWSER_CONFIGS.forEach(config => {
    if (!profileStats.has(config.name)) {
        profileStats.set(config.name, { ...defaultProfileStats });
    }
    profileRateLimitWindows.set(config.name, new Map());
});

// Load existing stats
loadProfileStats();

// Save stats every 5 minutes
setInterval(saveProfileStats, 5 * 60 * 1000);
setInterval(saveRateLimitStats, 5 * 60 * 1000);

// Update profile performance tracking
function updateProfilePerformance(profileName, event = {}) {
    const stats = profileStats.get(profileName);
    if (!stats) return;

    const now = Date.now();
    const performance = stats.performance;

    if (event.type === 'disconnect') {
        performance.disconnects++;
        performance.lastDisconnectReason = event.reason;

        if (stats.lastSuccess) {
            const uptime = now - stats.lastSuccess;
            // Update average uptime with weighted average
            performance.avgUptime = performance.avgUptime * 0.7 + uptime * 0.3;
        }

        // Update success rate
        const totalAttempts = stats.attempts || 1;
        performance.successRate = stats.successfulConnections / totalAttempts;

        // Check for performance degradation
        if (stats.consecutiveFailures >= PERFORMANCE_DEGRADATION_THRESHOLD) {
            performance.degradedUntil = now + PERFORMANCE_RECOVERY_TIME;
            console.log(`[Performance] Profile ${profileName} degraded until ${new Date(performance.degradedUntil).toISOString()}`);
        }
    }

    if (event.type === 'success') {
        // Reset degradation on successful connection
        if (performance.degradedUntil) {
            performance.degradedUntil = 0;
        }
        stats.lastSuccess = now;
        stats.consecutiveFailures = 0;
    }

    // Save updated stats
    saveRateLimitStats();
}

// Enhanced profile selection with weighted metrics
function getBestProfile() {
    const now = Date.now();
    let bestProfile = null;
    let bestScore = -Infinity;

    console.log('\n=== PROFILE SELECTION ===');
    for (const [name, stats] of profileStats) {
        // Skip profiles in cooling period or degraded state
        if (now - stats.lastAttempt < RATE_LIMIT_WINDOW ||
            (stats.performance.degradedUntil && now < stats.performance.degradedUntil)) {
            console.log(`${name}: SKIPPED (Cooling/Degraded)`);
            continue;
        }

        // Calculate weighted score based on multiple factors
        const uptime = stats.performance.avgUptime || 0;
        const successRate = stats.performance.successRate || 0;
        const rateLimitFactor = 1 / (stats.rateLimits + 1);
        const timeSinceLastAttempt = now - stats.lastAttempt;
        const coolingFactor = Math.min(timeSinceLastAttempt / RATE_LIMIT_WINDOW, 1);

        const score = (
            (uptime / (24 * 60 * 60 * 1000)) * 0.3 + // Normalize to 24h and weight 30%
            successRate * 0.3 +                       // Weight 30%
            rateLimitFactor * 0.2 +                   // Weight 20%
            coolingFactor * 0.2                       // Weight 20%
        );

        console.log(`${name} Score: ${score.toFixed(3)} (Uptime: ${Math.round(uptime / 1000)}s, Success: ${(successRate * 100).toFixed(1)}%, RateLimit: ${stats.rateLimits})`);

        if (score > bestScore) {
            bestScore = score;
            bestProfile = name;
        }
    }

    console.log(`Selected Profile: ${bestProfile} (Score: ${bestScore.toFixed(3)})`);
    console.log('========================\n');

    return bestProfile;
}


// Connection state tracking
let currentBrowserIndex = 0;
let connectionAttempts = 0;
let qrAttempts = 0;
let isConnected = false;
let messageHandlerInitialized = false;
let connectionMonitor = null;
let currentSocket = null;
let keepAliveInterval = null;
let lastReconnectTime = 0;
let consecutiveErrors = 0;
let rateLimitAttempts = 0;
let lastRateLimitTime = 0;
let lastProfileSwitch = 0;

// Initialize profile stats (already done above)


// Error categorization
const ErrorTypes = {
    AUTH_FAILURE: 'auth_failure',
    RATE_LIMIT: 'rate_limit',
    CONNECTION_ERROR: 'connection_error',
    PROTOCOL_ERROR: 'protocol_error',
    UNKNOWN: 'unknown'
};

// Calculate backoff delay with improved strategy
function calculateBackoff(attempt, isRateLimit = false) {
    const baseDelay = isRateLimit ? RATE_LIMIT_BASE_DELAY : RECONNECT_BASE_DELAY;
    const maxDelay = isRateLimit ? RATE_LIMIT_MAX_DELAY : RECONNECT_MAX_DELAY;
    const jitterFactor = isRateLimit ? 0.2 : RECONNECT_JITTER;

    // Exponential backoff with upper limit
    const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
    );

    // Add randomized jitter
    const jitter = delay * jitterFactor;
    const finalDelay = delay + (Math.random() * 2 - 1) * jitter;

    return Math.floor(finalDelay);
}

// Add enhanced logging before handleRateLimit function
function logProfileStats() {
    console.log('\n=== PROFILE STATISTICS ===');
    for (const [name, stats] of profileStats) {
        console.log(`Profile: ${name}`);
        console.log(`- Attempts: ${stats.attempts}`);
        console.log(`- Rate Limits: ${stats.rateLimits}`);
        console.log(`- Consecutive Failures: ${stats.consecutiveFailures}`);
        console.log(`- Successful Connections: ${stats.successfulConnections}`);
        console.log(`- Last Success: ${stats.lastSuccess ? new Date(stats.lastSuccess).toISOString() : 'Never'}`);
        console.log(`- Rate Limit Windows: ${profileRateLimitWindows.get(name).size}`);
        console.log(`- Average Uptime: ${stats.performance.avgUptime}ms`);
        console.log(`- Disconnects: ${stats.performance.disconnects}`);
        console.log(`- Last Disconnect Reason: ${stats.performance.lastDisconnectReason}`);
        console.log('------------------------');
    }
    console.log('=========================\n');
}

// Update handleRateLimit function to use enhanced profile tracking
function handleRateLimit(statusCode) {
    const now = Date.now();
    const currentProfile = BROWSER_CONFIGS[currentBrowserIndex];
    const stats = profileStats.get(currentProfile.name);
    const profileWindows = profileRateLimitWindows.get(currentProfile.name);

    console.log('\n=== RATE LIMIT HANDLING ===');
    console.log(`Profile: ${currentProfile.name}`);
    console.log(`Stats:`, {
        attempts: stats.attempts,
        rateLimits: stats.rateLimits,
        successRate: stats.performance.successRate,
        degradedUntil: stats.performance.degradedUntil ?
            new Date(stats.performance.degradedUntil).toISOString() : 'Not degraded',
        avgUptime: Math.round(stats.performance.avgUptime / 1000) + 's'
    });

    // Update stats
    stats.rateLimits++;
    stats.lastAttempt = now;
    stats.consecutiveFailures++;

    // Update performance metrics
    updateProfilePerformance(currentProfile.name, {
        type: 'disconnect',
        reason: 'rate_limit'
    });

    // Clear old windows
    for (const [timestamp] of profileWindows) {
        if (now - timestamp > RATE_LIMIT_WINDOW) {
            profileWindows.delete(timestamp);
        }
    }

    profileWindows.set(now, statusCode);

    // Calculate backoff based on profile health
    const baseMultiplier = Math.min(
        stats.rateLimits +
        stats.consecutiveFailures +
        (stats.performance.degradedUntil ? 5 : 0),
        10
    );

    console.log(`Base Backoff Multiplier: ${baseMultiplier}x`);
    const profileDelay = calculateBackoff(baseMultiplier, true);

    // Check rotation criteria with performance metrics
    const shouldRotate =
        stats.consecutiveFailures >= RATE_LIMIT_ATTEMPTS_BEFORE_ROTATE ||
        profileWindows.size >= RATE_LIMIT_ATTEMPTS_BEFORE_ROTATE ||
        stats.rateLimits >= 5 ||
        stats.performance.successRate < 0.3 || // Less than 30% success rate
        (stats.performance.degradedUntil && now < stats.performance.degradedUntil);

    if (shouldRotate) {
        console.log('\n⚠️ Profile rotation needed:');
        console.log(`- Success rate: ${(stats.performance.successRate * 100).toFixed(1)}%`);
        console.log(`- Consecutive failures: ${stats.consecutiveFailures}`);
        console.log(`- Rate limit windows: ${profileWindows.size}`);
        logProfileStats();

        rateLimitAttempts = 0;
        rotateToNextProfile();
        return { rotate: true, delay: profileDelay };
    }

    return { rotate: false, delay: profileDelay };
}

// Update rotateToNextProfile function
function rotateToNextProfile() {
    const now = Date.now();
    const minCoolingPeriod = RATE_LIMIT_WINDOW;

    // Log current state before rotation
    console.log('\n=== PROFILE ROTATION ===');
    console.log(`Current Profile: ${BROWSER_CONFIGS[currentBrowserIndex].name}`);
    logProfileStats();

    let rotationAttempts = 0;
    let foundSuitableProfile = false;

    while (!foundSuitableProfile && rotationAttempts < BROWSER_CONFIGS.length) {
        currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
        const profile = BROWSER_CONFIGS[currentBrowserIndex];
        const stats = profileStats.get(profile.name);

        console.log(`\nChecking profile: ${profile.name}`);
        console.log(`Time since last attempt: ${now - stats.lastAttempt}ms`);
        console.log(`Rate limits: ${stats.rateLimits}`);

        if (now - stats.lastAttempt >= minCoolingPeriod && stats.rateLimits < 5) {
            foundSuitableProfile = true;
            console.log(`✓ Selected ${profile.name} for next attempt`);
            break;
        } else {
            console.log(`✗ Profile ${profile.name} not suitable (cooling period: ${minCoolingPeriod - (now - stats.lastAttempt)}ms remaining)`);
        }

        rotationAttempts++;
    }

    if (!foundSuitableProfile) {
        const bestProfileName = getBestProfile();
        currentBrowserIndex = BROWSER_CONFIGS.findIndex(c => c.name === bestProfileName);
        console.log(`\n⚠️ No ideal profile found, using ${bestProfileName} as fallback`);
    }

    lastProfileSwitch = now;
    console.log('\n=== ROTATION COMPLETE ===\n');
}

// Update initializeConnection to use performance metrics
async function initializeConnection() {
    const now = Date.now();
    const config = BROWSER_CONFIGS[currentBrowserIndex];
    const stats = profileStats.get(config.name);

    console.log(`\n[Connection] Attempting connection with ${config.name} profile...`);

    // Check for degraded performance
    if (stats.performance.degradedUntil && now < stats.performance.degradedUntil) {
        console.log(`[Performance] Profile ${config.name} is degraded until ${new Date(stats.performance.degradedUntil).toISOString()}`);
        return null;
    }

    // Calculate dynamic initial delay based on profile health
    const baseDelay = INITIAL_CONNECTION_DELAY *
        (1 + (1 - (stats.performance.successRate || 0.5)) * 2);
    const initialDelay = Math.min(baseDelay * Math.pow(1.5, stats.rateLimits), RATE_LIMIT_MAX_DELAY);

    console.log(`[Connection] Waiting ${Math.round(initialDelay / 1000)}s before attempting connection...`);
    await new Promise(resolve => setTimeout(resolve, initialDelay));

    // Update stats
    stats.attempts++;
    stats.lastAttempt = now;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(config.auth_folder);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: config.fingerprint,
            version: [2, 2323, 4],
            connectTimeoutMs: CONNECTION_TIMEOUT,
            keepAliveIntervalMs: KEEP_ALIVE_INTERVAL,
            retryRequestDelayMs: stats.performance.degradedUntil ? 5000 : 1000,
            markOnlineOnConnect: true,
            userAgent: config.user_agent,
            logger: pino({ level: 'silent' }),
            defaultQueryTimeoutMs: 30000,
            emitOwnEvents: false,
            msgRetryCounterCache: {
                max: 1000,
                maxAge: 60 * 1000
            },
            ratelimitRequestOptions: {
                maxAttempts: 1,
                delayBetweenAttempts: 10000,
                onRateLimit: (delay) => {
                    console.log(`[Rate Limit] Request rate limited, delay: ${delay}ms`);
                    return false;
                }
            }
        });

        // Enhanced connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                handleQRCode(qr, config);
            }

            if (connection === 'open') {
                handleSuccessfulConnection(sock, saveCreds);
                updateProfilePerformance(config.name, { type: 'success' });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorType = categorizeError(statusCode, lastDisconnect?.error);

                console.log(`[Disconnection] Status code: ${statusCode}, Error type: ${errorType}`);
                updateProfilePerformance(config.name, {
                    type: 'disconnect',
                    reason: errorType
                });

                switch (errorType) {
                    case ErrorTypes.AUTH_FAILURE:
                        console.log('[Auth] Authentication failed, switching profile...');
                        rotateToNextProfile();
                        setTimeout(() => tryNextBrowser(), 5000);
                        break;

                    case ErrorTypes.RATE_LIMIT:
                        const { rotate, delay } = handleRateLimit(statusCode);
                        console.log(`[Rate Limit] Backing off for ${delay}ms before retry`);

                        if (rotate) {
                            setTimeout(() => tryNextBrowser(), delay);
                        } else {
                            setTimeout(() => handleConnectionRecovery(sock, 'rate_limit'), delay);
                        }
                        break;

                    case ErrorTypes.PROTOCOL_ERROR:
                        console.log('[Protocol] Protocol error detected, attempting immediate recovery');
                        handleConnectionRecovery(sock, 'protocol_error');
                        break;

                    default:
                        await handleConnectionRecovery(sock, `disconnect_${errorType}`);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (err) {
        console.error('[Connection] Error:', err.message);
        return null;
    }
}

// Initialize connection monitor with enhanced configuration
function initConnectionMonitor(sock) {
    if (connectionMonitor) {
        connectionMonitor.stopMonitoring();
    }

    connectionMonitor = new ConnectionMonitor({
        checkIntervalMs: 30000,
        maxReconnectAttempts: 10,
        reconnectBackoffMs: RECONNECT_BASE_DELAY,
        autoReconnect: true,
        notifyDiscoveredIssues: true,
        logFilePath: path.join(process.cwd(), 'connection-monitor.log')
    });

    connectionMonitor.startMonitoring(sock);
}

// Enhanced keep-alive mechanism with health checks
function startKeepAlive(sock) {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }

    keepAliveInterval = setInterval(async () => {
        try {
            // Send keep-alive signal with timestamp
            if (sock?.ws?.readyState === sock?.ws?.OPEN) {
                sock.ws.send(`KeepAlive:${Date.now()}`);
            }

            // Perform comprehensive health check
            const health = await connectionMonitor?.checkHealth();
            if (health?.healthScore < 50) {
                console.log('[KeepAlive] Poor connection health detected, initiating recovery...');
                await handleConnectionRecovery(sock, 'health_check');
            }

            // Reset consecutive error counter on successful keep-alive
            consecutiveErrors = 0;
        } catch (err) {
            console.error('[KeepAlive] Error:', err.message);
            consecutiveErrors++;

            // Force recovery after multiple consecutive errors
            if (consecutiveErrors >= 3) {
                console.log('[KeepAlive] Multiple consecutive errors, forcing recovery...');
                await handleConnectionRecovery(sock, 'consecutive_errors');
            }
        }
    }, KEEP_ALIVE_INTERVAL);
}

// Enhanced memory optimization with progressive cleanup
function optimizeMemory() {
    try {
        const memUsage = process.memoryUsage();
        const heapUsed = memUsage.heapUsed;
        const rss = memUsage.rss;

        console.log(`[Memory] Stats - Heap: ${Math.round(heapUsed / 1024 / 1024)}MB, RSS: ${Math.round(rss / 1024 / 1024)}MB`);

        if (heapUsed > MEMORY_CRITICAL) {
            console.log('[Memory] Critical memory usage detected, performing aggressive cleanup...');

            if (global.gc) {
                global.gc();
                global.gc(); // Double GC for better cleanup
            }

            // Clear all caches
            if (currentSocket?.store) {
                currentSocket.store.messages.clear();
                currentSocket.store.chats.clear();
                currentSocket.store.contacts.clear();
                currentSocket.store.presences.clear();
            }

            if (process.memoryUsage().heapUsed > MEMORY_CRITICAL) {
                console.log('[Memory] Memory still critical after cleanup, initiating connection reset...');
                handleConnectionRecovery(currentSocket, 'memory_critical');
            }
        } else if (heapUsed > MEMORY_THRESHOLD) {
            console.log('[Memory] High memory usage detected, performing standard cleanup...');

            if (global.gc) {
                global.gc();
            }

            // Selective cache cleanup
            if (currentSocket?.store) {
                const now = Date.now();
                currentSocket.store.messages.filter(msg => (now - msg.messageTimestamp * 1000) > 3600000);
            }
        }
    } catch (err) {
        console.error('[Memory] Optimization error:', err.message);
    }
}

// Update handleSuccessfulConnection to track successes
function handleSuccessfulConnection(sock, saveCreds) {
    const now = Date.now();
    console.log('\n✅ Connected successfully!');

    const currentProfile = BROWSER_CONFIGS[currentBrowserIndex];
    const stats = profileStats.get(currentProfile.name);

    // Update profile stats
    stats.successfulConnections++;
    stats.consecutiveFailures = 0;
    stats.lastSuccess = now;
    stats.rateLimits = Math.max(0, stats.rateLimits - 1); // Reduce rate limits on success

    isConnected = true;
    currentSocket = sock;
    connectionAttempts = 0;
    consecutiveErrors = 0;

    // Initialize monitoring
    initConnectionMonitor(sock);
    startKeepAlive(sock);

    // Clear rate limit windows on successful connection
    const profileWindows = profileRateLimitWindows.get(currentProfile.name);
    profileWindows.clear();

    // Save credentials
    saveCreds();

    // Initialize message handler if needed
    if (!messageHandlerInitialized) {
        try {
            const messageHandler = require('./src/simplified-message-handler');
            messageHandler.init(sock);
            messageHandlerInitialized = true;
            console.log('✅ Message handler initialized');
        } catch (err) {
            console.error('[Handler] Error:', err.message);
        }
    }
    updateProfilePerformance(currentProfile.name, { type: 'success' });
}

// Enhanced connection recovery with error categorization
async function handleConnectionRecovery(sock, reason = 'unknown') {
    try {
        console.log(`[Recovery] Initiating connection recovery... Reason: ${reason}`);

        // Stop existing monitoring
        connectionMonitor?.stopMonitoring();
        clearInterval(keepAliveInterval);

        // Implement backoff for frequent recoveries
        const now = Date.now();
        const timeSinceLastReconnect = now - lastReconnectTime;

        if (timeSinceLastReconnect < RECONNECT_BASE_DELAY) {
            const backoffDelay = calculateBackoff(connectionAttempts);
            console.log(`[Recovery] Too many reconnects, backing off for ${backoffDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        // Attempt graceful logout
        try {
            await sock?.logout();
        } catch (err) {
            // Ignore logout errors
        }

        // Reset connection state
        lastReconnectTime = now;
        connectionAttempts++;

        // Initialize fresh connection
        currentSocket = await initializeConnection();

        if (currentSocket) {
            console.log('[Recovery] Connection recovered successfully');
            initConnectionMonitor(currentSocket);
            startKeepAlive(currentSocket);
            consecutiveErrors = 0;
        } else {
            console.log('[Recovery] Connection recovery failed, will retry with next browser profile');
            currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
            setTimeout(() => tryNextBrowser(), 5000);
        }
    } catch (err) {
        console.error('[Recovery] Error during recovery:', err.message);
        currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
        setTimeout(() => tryNextBrowser(), 5000);
    }
}

// Categorize connection errors for better handling
function categorizeError(statusCode, error) {
    if (statusCode === DisconnectReason.loggedOut ||
        statusCode === 401 ||
        statusCode === 403) {
        return ErrorTypes.AUTH_FAILURE;
    }

    if (statusCode === 405 || statusCode === 429) {
        return ErrorTypes.RATE_LIMIT;
    }

    if (statusCode >= 500 && statusCode <= 599) {
        return ErrorTypes.CONNECTION_ERROR;
    }

    if (error?.message?.includes('protocol') ||
        error?.message?.includes('websocket')) {
        return ErrorTypes.PROTOCOL_ERROR;
    }

    return ErrorTypes.UNKNOWN;
}


// Handle QR code generation
function handleQRCode(qr, config) {
    qrAttempts++;
    console.clear();
    console.log('\n=== BLACKSKY-MD WHATSAPP QR ===');
    console.log(`Browser: ${config.name} (Attempt ${qrAttempts}/${MAX_QR_ATTEMPTS})`);
    qrcode.generate(qr, { small: true });

    if (qrAttempts >= MAX_QR_ATTEMPTS) {
        console.log('[QR] Max attempts reached, trying next browser...');
        currentBrowserIndex = (currentBrowserIndex + 1) % BROWSER_CONFIGS.length;
        qrAttempts = 0;
        setTimeout(() => tryNextBrowser(), 2000);
    }
}


// Try connecting with the next browser configuration
async function tryNextBrowser() {
    // Reset if we've tried all browsers
    if (currentBrowserIndex >= BROWSER_CONFIGS.length) {
        console.log('Tried all browser configurations. Starting over with the first one...');
        currentBrowserIndex = 0;
        // Add additional backoff when cycling through all browsers
        await new Promise(resolve => setTimeout(resolve, RECONNECT_BASE_DELAY));
    }

    currentSocket = await initializeConnection();
}

// Start connection process
async function startConnection() {
    // Set up memory optimization interval
    setInterval(optimizeMemory, MEMORY_CHECK_INTERVAL);

    // Initialize connection
    currentSocket = await initializeConnection();

    if (!currentSocket) {
        console.log('[Startup] Initial connection failed, retrying...');
        setTimeout(() => tryNextBrowser(), 5000);
    }
}

// Create folders if they don't exist
BROWSER_CONFIGS.forEach(config => {
    if (!fs.existsSync(config.auth_folder)) {
        fs.mkdirSync(config.auth_folder, { recursive: true });
    }
});

// Display banner
console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║    BLACKSKY-MD ADVANCED CONNECTION MANAGER        ║
║                                                   ║
║  • Enhanced error handling and recovery           ║
║  • Smart backoff with jitter                     ║
║  • Optimized for network stability               ║
║  • Automatic browser profile rotation            ║
║                                                   ║
║  Wait for the QR code to appear and scan it       ║
║  with your WhatsApp mobile app                    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);

// Start connection sequence
startConnection().catch(err => {
    console.error('Fatal error:', err);
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, cleaning up...');
    connectionMonitor?.stopMonitoring();
    clearInterval(keepAliveInterval);

    try {
        await currentSocket?.logout();
    } catch (err) {
        // Ignore logout errors
    }

    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    optimizeMemory();
    console.log('Bot will continue running despite the error');
});

module.exports = { startConnection };