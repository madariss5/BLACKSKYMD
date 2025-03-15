/**
 * Safari-based WhatsApp Connection
 * Advanced connection system optimized for cloud environments
 * Features automatic credential backup and enhanced error recovery
 * Version: 1.3.1
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fsPromises = require('fs').promises;
const dns = require('dns');
const http = require('http');
const https = require('https');

// Initialize Express
const app = express();
const port = process.env.PORT || 5000;

// Configuration
const AUTH_FOLDER = process.env.AUTH_DIR || './auth_info_safari';
const VERSION = '1.3.1';
const MAX_RETRIES = 10;
const QR_TIMEOUT = 60000; // 1 minute QR timeout
const RECONNECT_BASE_DELAY = 5000; // 5 seconds base delay
const MAX_RECONNECT_DELAY = 60000; // 1 minute max delay
const HTTP_TIMEOUT = 10000; // 10 seconds HTTP timeout
const MAX_HTTP_RETRIES = 3; // Maximum HTTP connection retries
const CIRCUIT_BREAKER_THRESHOLD = 3; // Number of failures before circuit breaks
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000; // 30 seconds before resetting circuit

// Environment detection
const IS_CLOUD_ENV = process.env.REPLIT_ID || process.env.HEROKU_APP_ID;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Setup logger with enhanced error tracking
const LOGGER = pino({ 
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: false,
      ignore: 'hostname,pid',
      translateTime: 'SYS:standard'
    }
  }
}).child({ name: 'BLACKSKY-MD' });

// Connection state management
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTHENTICATING: 'authenticating',
  AWAITING_QR: 'awaiting_qr',
  ERROR: 'error',
  RETRYING: 'retrying',
  CIRCUIT_OPEN: 'circuit_open'
};

// Browser fingerprints with enhanced variety
const BROWSER_FINGERPRINTS = [
  {
    device: 'Safari on MacOS',
    platform: 'darwin',
    browser: ['Safari', '17.0'],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  },
  {
    device: 'Chrome on MacOS',
    platform: 'darwin',
    browser: ['Chrome', '120.0.0'],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  {
    device: 'Firefox on MacOS',
    platform: 'darwin',
    browser: ['Firefox', '120.0'],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0'
  }
];

// WhatsApp endpoint configurations with health tracking
const WA_ENDPOINTS = [
  'web.whatsapp.com',
  'web-v2.whatsapp.com', 
  'web-v3.whatsapp.com'
].map(endpoint => ({
  url: endpoint,
  failures: 0,
  lastFailure: null,
  status: 'available'
}));

// Connection state
let sock = null;
let connectionRetries = 0;
let qrDisplayTimer = null;
let qrGenerated = false;
let connectionState = ConnectionState.DISCONNECTED;
let lastDisconnectCode = null;
let lastQRCode = null;
let isReconnecting = false;
let lastConnectTime = null;
let qrRetryCount = 0;
let connectionErrors = [];
let currentBrowserIndex = 0;
let currentEndpointIndex = 0;
let circuitBreakerFailures = 0;
let circuitBreakerTimer = null;

// Endpoint health tracking
function markEndpointFailure(index, reason) {
  const endpoint = WA_ENDPOINTS[index];
  endpoint.failures++;
  endpoint.lastFailure = new Date();
  endpoint.status = endpoint.failures >= 3 ? 'unavailable' : 'degraded';

  LOGGER.warn(`Endpoint ${endpoint.url} marked as ${endpoint.status} (Failures: ${endpoint.failures}, Reason: ${reason})`);
}

function resetEndpointStatus(index) {
  const endpoint = WA_ENDPOINTS[index];
  endpoint.failures = 0;
  endpoint.lastFailure = null;
  endpoint.status = 'available';

  LOGGER.info(`Endpoint ${endpoint.url} reset to available status`);
}

// Get next available endpoint
function getNextViableEndpoint() {
  const startIndex = currentEndpointIndex;
  let attempts = 0;

  while (attempts < WA_ENDPOINTS.length) {
    currentEndpointIndex = (currentEndpointIndex + 1) % WA_ENDPOINTS.length;
    const endpoint = WA_ENDPOINTS[currentEndpointIndex];

    if (endpoint.status !== 'unavailable') {
      LOGGER.info(`Switching to endpoint: ${endpoint.url} (Status: ${endpoint.status})`);
      return endpoint;
    }
    attempts++;
  }

  // If all endpoints are unavailable, reset the first one and use it
  currentEndpointIndex = startIndex;
  resetEndpointStatus(currentEndpointIndex);
  return WA_ENDPOINTS[currentEndpointIndex];
}

// Proxy and connection optimization for cloud environments
const PROXY_CONFIG = IS_CLOUD_ENV ? {
  agent: undefined,
  fetchAgent: undefined,
  connectTimeoutMs: 60000,
  useProxy: true,
  proxyTimeout: 30000,
  maxIdleTimeMs: 60000,
  maxRetries: 5,
  defaultQueryTimeoutMs: 60000,
  syncFullHistory: false
} : {};

// Express routes for monitoring
app.get('/', (req, res) => {
  const uptime = lastConnectTime ? Math.floor((Date.now() - lastConnectTime) / 1000) : 0;
  const currentEndpoint = WA_ENDPOINTS[currentEndpointIndex];

  res.json({
    status: connectionState,
    retries: connectionRetries,
    maxRetries: MAX_RETRIES,
    hasQR: !!lastQRCode,
    qrRetries: qrRetryCount,
    lastError: lastDisconnectCode,
    version: VERSION,
    uptime: uptime,
    isReconnecting,
    currentBrowser: BROWSER_FINGERPRINTS[currentBrowserIndex].device,
    currentEndpoint: currentEndpoint.url,
    endpointStatus: currentEndpoint.status,
    circuitBreakerStatus: circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD ? 'OPEN' : 'CLOSED',
    recentErrors: connectionErrors.slice(-5),
    endpoints: WA_ENDPOINTS.map(e => ({
      url: e.url,
      status: e.status,
      failures: e.failures,
      lastFailure: e.lastFailure
    }))
  });
});

// Enhanced auth file validation
async function validateAuthFiles() {
  try {
    LOGGER.info('Validating authentication files...');

    if (!fs.existsSync(AUTH_FOLDER)) {
      LOGGER.info('Auth folder not found');
      return false;
    }

    const files = await fsPromises.readdir(AUTH_FOLDER);
    LOGGER.info(`Found ${files.length} files in auth folder`);

    if (files.length === 0) {
      LOGGER.info('Auth folder is empty');
      return false;
    }

    // Check critical files
    const hasCredsJson = files.includes('creds.json');
    LOGGER.info(`creds.json present: ${hasCredsJson}`);

    const authFiles = files.filter(f => f.startsWith('auth_'));
    LOGGER.info(`Auth files found: ${authFiles.length}`);

    if (!hasCredsJson || authFiles.length === 0) {
      LOGGER.warn('Missing critical auth files');
      return false;
    }

    // Validate creds.json content
    try {
      const credsPath = path.join(AUTH_FOLDER, 'creds.json');
      const credsContent = await fsPromises.readFile(credsPath, 'utf8');
      const creds = JSON.parse(credsContent);

      LOGGER.info('Validating creds.json structure...');
      const requiredKeys = ['noiseKey', 'signedIdentityKey', 'signedPreKey', 'registrationId'];
      const missingKeys = requiredKeys.filter(key => !creds[key]);

      if (missingKeys.length > 0) {
        LOGGER.warn(`Invalid creds.json: Missing keys: ${missingKeys.join(', ')}`);
        return false;
      }

      LOGGER.info('creds.json validation successful');
      return true;
    } catch (err) {
      LOGGER.error('Error validating creds.json:', err);
      return false;
    }
  } catch (err) {
    LOGGER.error('Error during auth validation:', err);
    return false;
  }
}

// Enhanced network diagnostics
async function checkNetworkConnectivity() {
  if (isCircuitBroken()) {
    LOGGER.warn('Circuit breaker is open, skipping network check');
    return false;
  }

  LOGGER.info('Running network diagnostics...');

  const currentEndpoint = WA_ENDPOINTS[currentEndpointIndex];
  LOGGER.info(`Testing endpoint ${currentEndpoint.url} (Status: ${currentEndpoint.status})`);

  // DNS resolution with detailed logging
  try {
    const addresses = await new Promise((resolve, reject) => {
      dns.resolve4(currentEndpoint.url, (err, addrs) => {
        if (err) reject(err);
        else resolve(addrs);
      });
    });

    LOGGER.info(`DNS resolution successful for ${currentEndpoint.url}:`, addresses);
  } catch (err) {
    LOGGER.error(`DNS resolution failed for ${currentEndpoint.url}:`, err);
    markEndpointFailure(currentEndpointIndex, 'DNS_FAILURE');
    getNextViableEndpoint();
    return false;
  }

  // HTTP connectivity check with detailed diagnostics
  try {
    LOGGER.info(`Testing HTTP connectivity to https://${currentEndpoint.url}`);

    const response = await new Promise((resolve, reject) => {
      const req = https.get(`https://${currentEndpoint.url}`, { 
        timeout: HTTP_TIMEOUT,
        ...PROXY_CONFIG
      }, res => {
        LOGGER.info(`HTTP response from ${currentEndpoint.url}: ${res.statusCode}`);
        res.destroy();
        resolve(res);
      });

      req.on('error', err => {
        LOGGER.error(`HTTP request failed for ${currentEndpoint.url}:`, err);
        reject(err);
      });

      req.on('timeout', () => {
        LOGGER.error(`HTTP request timed out for ${currentEndpoint.url}`);
        req.destroy();
        reject(new Error('Timeout'));
      });
    });

    if (response.statusCode === 405) {
      LOGGER.warn(`Endpoint ${currentEndpoint.url} returned 405 - marking as degraded`);
      markEndpointFailure(currentEndpointIndex, 'STATUS_405');
      getNextViableEndpoint();
      return false;
    }

    if (response.statusCode >= 400) {
      LOGGER.warn(`Endpoint ${currentEndpoint.url} returned ${response.statusCode}`);
      markEndpointFailure(currentEndpointIndex, `STATUS_${response.statusCode}`);
      getNextViableEndpoint();
      return false;
    }

    LOGGER.info(`Successfully connected to ${currentEndpoint.url}`);
    resetEndpointStatus(currentEndpointIndex);
    return true;
  } catch (err) {
    LOGGER.error(`Connection failed to ${currentEndpoint.url}:`, err);
    markEndpointFailure(currentEndpointIndex, 'CONNECTION_ERROR');
    getNextViableEndpoint();
    return false;
  }
}

// Initialize connection with enhanced validation
async function initializeConnection() {
  try {
    LOGGER.info('Initializing connection...');
    connectionState = ConnectionState.CONNECTING;

    // Check network connectivity first
    const networkOk = await checkNetworkConnectivity();
    if (!networkOk) {
      LOGGER.error('Network connectivity check failed');
      throw new Error('Network connectivity check failed');
    }

    // Validate existing auth state
    const hasValidAuth = await validateAuthFiles();
    LOGGER.info(`Auth validation result: ${hasValidAuth}`);

    if (!hasValidAuth) {
      LOGGER.info('Clearing invalid auth state...');
      if (fs.existsSync(AUTH_FOLDER)) {
        // Backup existing auth files before clearing
        const backupFolder = `${AUTH_FOLDER}_backup_${Date.now()}`;
        await fsPromises.cp(AUTH_FOLDER, backupFolder, { recursive: true })
          .catch(err => LOGGER.warn('Failed to create auth backup:', err));

        await fsPromises.rm(AUTH_FOLDER, { recursive: true, force: true });
      }
      await fsPromises.mkdir(AUTH_FOLDER, { recursive: true });
    }

    // Reset connection state
    qrRetryCount = 0;
    lastQRCode = null;
    if (qrDisplayTimer) clearTimeout(qrDisplayTimer);

  } catch (err) {
    LOGGER.error('Error in initialization:', err);
    connectionErrors.push({
      timestamp: new Date().toISOString(),
      type: 'INIT_ERROR',
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

// Start connection with enhanced error handling
async function startConnection() {
  try {
    if (isCircuitBroken()) {
      LOGGER.warn('Circuit breaker is open, delaying connection attempt');
      return;
    }

    connectionState = ConnectionState.CONNECTING;
    LOGGER.info(`Starting WhatsApp connection (Attempt ${connectionRetries + 1}/${MAX_RETRIES})`);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    const currentEndpoint = WA_ENDPOINTS[currentEndpointIndex];
    const fingerprint = BROWSER_FINGERPRINTS[currentBrowserIndex];

    LOGGER.info(`Using endpoint: ${currentEndpoint.url}`);
    LOGGER.info(`Using browser fingerprint: ${fingerprint.device}`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: [generateDeviceId(), ...fingerprint.browser],
      browserDescription: [fingerprint.device, fingerprint.platform, VERSION],
      userAgent: fingerprint.userAgent,
      connectTimeoutMs: 60000,
      qrTimeout: QR_TIMEOUT,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: false,
      markOnlineOnConnect: false,
      logger: LOGGER,
      customUploadHosts: ['media-sin1-1.cdn.whatsapp.net'],
      syncFullHistory: false,
      ...PROXY_CONFIG
    });

    sock.ev.on('connection.update', handleConnectionUpdate);
    sock.ev.on('creds.update', async (creds) => {
      LOGGER.info('Credentials updated, saving...');
      await saveCreds();
    });

  } catch (err) {
    LOGGER.error('Error in connection:', err);
    connectionErrors.push({
      timestamp: new Date().toISOString(),
      type: 'CONNECTION_ERROR',
      error: err.message,
      stack: err.stack
    });

    recordFailure();

    if (connectionRetries < MAX_RETRIES && !isCircuitBroken()) {
      connectionRetries++;
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, connectionRetries - 1), MAX_RECONNECT_DELAY);
      LOGGER.info(`Retrying in ${delay/1000}s (Attempt ${connectionRetries}/${MAX_RETRIES})`);
      setTimeout(startConnection, delay);
    } else {
      LOGGER.error('Max retries reached or circuit breaker open');
      process.exit(1);
    }
  }
}

// Circuit breaker implementation
function isCircuitBroken() {
  return circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD;
}

function recordFailure() {
  circuitBreakerFailures++;
  if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    LOGGER.warn('Circuit breaker opened due to multiple failures');
    connectionState = ConnectionState.CIRCUIT_OPEN;

    if (circuitBreakerTimer) clearTimeout(circuitBreakerTimer);
    circuitBreakerTimer = setTimeout(() => {
      LOGGER.info('Circuit breaker reset timeout reached, resetting failures');
      circuitBreakerFailures = 0;
      connectionState = ConnectionState.DISCONNECTED;
    }, CIRCUIT_BREAKER_RESET_TIMEOUT);
  }
}

function resetCircuitBreaker() {
  circuitBreakerFailures = 0;
  if (circuitBreakerTimer) {
    clearTimeout(circuitBreakerTimer);
    circuitBreakerTimer = null;
  }
}

// Handle connection updates with comprehensive error handling
async function handleConnectionUpdate(update) {
  try {
    const { connection, lastDisconnect, qr } = update;

    LOGGER.debug('Connection update:', {
      connection,
      state: connectionState,
      retries: connectionRetries,
      hasQR: !!qr,
      errorCode: lastDisconnect?.error?.output?.statusCode,
      endpoint: WA_ENDPOINTS[currentEndpointIndex].url
    });

    if (qr) {
      qrGenerated = true;
      lastQRCode = qr;
      connectionState = ConnectionState.AWAITING_QR;
      displayQRCode(qr);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || 'Unknown';

      lastDisconnectCode = statusCode;
      connectionState = ConnectionState.DISCONNECTED;
      lastConnectTime = null;

      connectionErrors.push({
        timestamp: new Date().toISOString(),
        type: 'DISCONNECT',
        code: statusCode,
        reason: reason,
        endpoint: WA_ENDPOINTS[currentEndpointIndex].url
      });

      LOGGER.info(`Connection closed (Code: ${statusCode}). Reason: ${reason}`);

      if (statusCode === DisconnectReason.loggedOut || 
          (lastDisconnect?.error instanceof Boom && lastDisconnect.error.output.statusCode === 440)) {
        LOGGER.warn('Session expired or logged out');
        await handleReconnection('Session expired', true);
      } else if (statusCode === 405) {
        LOGGER.warn(`Rate limit (405) detected on endpoint ${WA_ENDPOINTS[currentEndpointIndex].url}`);
        markEndpointFailure(currentEndpointIndex, 'STATUS_405');
        getNextViableEndpoint();
        await handleReconnection('Rate limit', false);
      } else {
        await handleReconnection('Generic error', false);
      }
    } else if (connection === 'open') {
      connectionState = ConnectionState.CONNECTED;
      lastQRCode = null;
      qrRetryCount = 0;
      connectionRetries = 0;
      lastConnectTime = Date.now();
      connectionErrors = [];
      resetCircuitBreaker();
      resetEndpointStatus(currentEndpointIndex);

      if (qrDisplayTimer) clearTimeout(qrDisplayTimer);

      LOGGER.info('✅ SUCCESSFULLY CONNECTED TO WHATSAPP!');
      LOGGER.info(`📱 Connected as: ${sock.user?.id || 'Unknown'}`);
      LOGGER.info(`📡 Using endpoint: ${WA_ENDPOINTS[currentEndpointIndex].url}`);

      try {
        if (sock?.user) {
          await sock.sendMessage(sock.user.id, { 
            text: `🤖 *BLACKSKY-MD Bot Connected!*\n\n` +
                  `_Connection Time: ${new Date().toLocaleString()}_\n` +
                  `_Version: ${VERSION}_\n` +
                  `_Endpoint: ${WA_ENDPOINTS[currentEndpointIndex].url}_\n\n` +
                  `Send *!help* to see available commands.` 
          });
          LOGGER.info('Welcome message sent');
        }
      } catch (err) {
        LOGGER.error('Error sending welcome message:', err);
      }
    }
  } catch (err) {
    LOGGER.error('Error in connection update handler:', err);
    connectionErrors.push({
      timestamp: new Date().toISOString(),
      type: 'UPDATE_HANDLER_ERROR',
      error: err.message,
      stack: err.stack
    });
  }
}

// Display QR code with enhanced error handling
function displayQRCode(qr) {
  try {
    LOGGER.info(`Generating QR code (Attempt ${qrRetryCount + 1}/${MAX_RETRIES})`);

    qrcode.generate(qr, { small: true }, (err, qrOutput) => {
      if (err) {
        LOGGER.error('Primary QR generation failed:', err);
        console.log('\nQR Code Data (Fallback):', qr);
        return;
      }

      console.log('\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
      console.log('█                   SCAN QR CODE TO CONNECT                      █');
      console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n');
      console.log(qrOutput);
      console.log('\n▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄');
      console.log(`█  Scan within ${QR_TIMEOUT/1000} seconds. Attempt ${qrRetryCount + 1} of ${MAX_RETRIES}   █`);
      console.log('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n');
    });

    if (qrDisplayTimer) clearTimeout(qrDisplayTimer);
    qrDisplayTimer = setTimeout(() => {
      if (connectionState === ConnectionState.AWAITING_QR) {
        LOGGER.warn('QR code expired, initiating new QR generation');
        qrRetryCount++;
        if (qrRetryCount < MAX_RETRIES) {
          handleReconnection('QR timeout');
        } else {
          LOGGER.error('Max QR retry attempts reached');
          process.exit(1);
        }
      }
    }, QR_TIMEOUT);

  } catch (err) {
    LOGGER.error('Critical error in QR generation:', err);
    connectionErrors.push({
      timestamp: new Date().toISOString(),
      type: 'QR_GENERATION_ERROR',
      error: err.message,
      stack: err.stack
    });

    console.log('\nQR Code Data (Emergency Fallback):', qr);
  }
}

// Generate unique device ID
function generateDeviceId() {
  const randomString = Math.random().toString(36).substring(2, 7);
  const timestamp = Date.now().toString().slice(-6);
  return `BLACKSKY-MD-${timestamp}-${randomString}`;
}

// Handle reconnection with exponential backoff
async function handleReconnection(reason, resetRetries = false) {
  if (isReconnecting) {
    LOGGER.info('Reconnection already in progress');
    return;
  }

  try {
    isReconnecting = true;
    connectionState = ConnectionState.RETRYING;

    if (resetRetries) {
      connectionRetries = 0;
      qrRetryCount = 0;
    }

    if (connectionRetries >= MAX_RETRIES || isCircuitBroken()) {
      LOGGER.error('Max retries reached or circuit breaker open');
      process.exit(1);
      return;
    }

    connectionRetries++;
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, connectionRetries - 1), MAX_RECONNECT_DELAY);

    LOGGER.info(`Reconnecting in ${delay/1000}s (Attempt ${connectionRetries}/${MAX_RETRIES})`);
    await new Promise(resolve => setTimeout(resolve, delay));

    await initializeConnection();
    await startConnection();

  } catch (err) {
    LOGGER.error('Error during reconnection:', err);
    connectionErrors.push({
      timestamp: new Date().toISOString(),
      type: 'RECONNECTION_ERROR',
      error: err.message,
      stack: err.stack
    });
    recordFailure();
  } finally {
    isReconnecting = false;
  }
}

// Start Express server
async function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0')
      .once('error', (err) => {
        LOGGER.error('Server error:', err);
        reject(err);
      })
      .once('listening', () => {
        LOGGER.info(`Server started on port ${port}`);
        resolve(server);
      });
  });
}

// Main startup sequence
async function startup() {
  try {
    // Start server first
    const server = await startServer();

    // Handle shutdown
    process.on('SIGTERM', () => {
      LOGGER.info('Received SIGTERM');
      server.close(() => {
        LOGGER.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      LOGGER.info('Received SIGINT');
      server.close(() => {
        LOGGER.info('Server closed');
        process.exit(0);
      });
    });

    // Then initialize WhatsApp connection
    await initializeConnection();
    await startConnection();
  } catch (err) {
    LOGGER.error('Startup error:', err);
    process.exit(1);
  }
}

// Start the application
startup();

// Export connection state for monitoring
module.exports = {
  getConnectionState: () => ({
    state: connectionState,
    retries: connectionRetries,
    maxRetries: MAX_RETRIES,
    lastError: lastDisconnectCode,
    qrGenerated,
    hasQR: !!lastQRCode,
    uptime: lastConnectTime ? Math.floor((Date.now() - lastConnectTime) / 1000) : 0,
    currentEndpoint: WA_ENDPOINTS[currentEndpointIndex].url,
    endpoints: WA_ENDPOINTS.map(e => ({
      url: e.url,
      status: e.status,
      failures: e.failures
    })),
    recentErrors: connectionErrors.slice(-5)
  })
};