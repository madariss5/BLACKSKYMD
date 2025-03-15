/**
 * WhatsApp Connection Monitor Utility
 * Provides real-time connection health monitoring and recovery capabilities
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Connection health states
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed'
};

class ConnectionMonitor {
  constructor(options = {}) {
    this.options = {
      checkIntervalMs: 30000, // Check connection every 30 seconds
      maxReconnectAttempts: 5, // Maximum reconnect attempts before giving up
      reconnectBackoffMs: 5000, // Initial reconnect delay, doubled each attempt
      logFilePath: path.join(process.cwd(), 'connection-logs.json'),
      autoReconnect: true, // Whether to automatically try reconnecting
      notifyDiscoveredIssues: true, // Whether to notify about discovered issues
      ...options
    };
    
    this.status = ConnectionState.DISCONNECTED;
    this.lastSyncTime = 0;
    this.reconnectAttempts = 0;
    this.healthScore = 100;
    this.intervalId = null;
    this.lastErrors = [];
    this.logs = [];
    this.sock = null;
    this.recoveryMode = false;
    this.diagnosticResults = {};
  }

  /**
   * Start monitoring a WhatsApp connection
   * @param {Object} sock - WhatsApp socket connection
   */
  startMonitoring(sock) {
    if (!sock) {
      throw new Error("Socket connection is required for monitoring");
    }
    
    this.sock = sock;
    this.status = ConnectionState.CONNECTING;
    this.log("Connection monitoring started");
    
    // Setup check interval
    this.intervalId = setInterval(() => this.checkHealth(), this.options.checkIntervalMs);
    
    // Set up event listeners
    if (sock.ev) {
      this.setupEventListeners();
    }
    
    return this;
  }
  
  /**
   * Stop monitoring the connection
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.log("Connection monitoring stopped");
    return this;
  }
  
  /**
   * Set up WhatsApp event listeners
   */
  setupEventListeners() {
    if (!this.sock || !this.sock.ev) return;
    
    // Connection state events
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update || {};
      
      if (connection === 'open') {
        this.status = ConnectionState.CONNECTED;
        this.reconnectAttempts = 0;
        this.healthScore = 100;
        this.log("Connection established successfully");
      } 
      else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message || 'Unknown disconnect reason';
        
        this.status = ConnectionState.DISCONNECTED;
        this.healthScore -= 20; // Reduce health score on disconnect
        this.log(`Connection closed: ${message} (Status code: ${statusCode || 'unknown'})`);
        
        if (this.options.autoReconnect) {
          this.reconnect(statusCode);
        }
      }
      
      if (qr) {
        this.log("New QR code generated");
      }
    });
    
    // Message receipt events - useful for checking if connection is working
    this.sock.ev.on('messages.update', () => {
      this.lastSyncTime = Date.now();
    });
    
    // Creds update events - important for auth state
    this.sock.ev.on('creds.update', () => {
      this.log("Credentials updated");
    });
  }
  
  /**
   * Check the connection health
   * @returns {Object} Health status
   */
  async checkHealth() {
    if (!this.sock) return { status: ConnectionState.DISCONNECTED, healthScore: 0 };
    
    try {
      const now = Date.now();
      const timeSinceLastSync = now - this.lastSyncTime;
      
      // If we haven't seen activity for 2 minutes, the connection might be dead
      if (this.status === ConnectionState.CONNECTED && timeSinceLastSync > 120000) {
        this.healthScore -= 10;
        this.log("No recent sync activity, connection might be stale");
        
        if (this.healthScore < 50 && this.options.autoReconnect) {
          this.status = ConnectionState.RECONNECTING;
          this.reconnect();
        }
      }
      
      // If in recovery mode, check if connection is restored
      if (this.recoveryMode && this.status === ConnectionState.CONNECTED) {
        this.recoveryMode = false;
        this.log("Connection recovered successfully");
        this.healthScore = 90; // Restore most of the health score
      }
      
      // Run diagnostics every 5 checks (by default, every 2.5 minutes)
      if (this.logs.length % 5 === 0) {
        await this.runDiagnostics();
      }
      
      return {
        status: this.status,
        healthScore: this.healthScore,
        timeSinceLastSync,
        reconnectAttempts: this.reconnectAttempts,
        lastErrors: this.lastErrors
      };
    } catch (error) {
      this.log(`Health check error: ${error.message}`);
      this.lastErrors.push({
        time: new Date().toISOString(),
        message: error.message
      });
      
      if (this.lastErrors.length > 5) {
        this.lastErrors.shift();
      }
      
      return {
        status: this.status,
        healthScore: Math.max(0, this.healthScore - 5),
        error: error.message
      };
    }
  }
  
  /**
   * Run connection diagnostics
   */
  async runDiagnostics() {
    try {
      // Check if WhatsApp web is reachable
      const webWhatsappCheck = await this.checkDomain('web.whatsapp.com');
      
      // Check for auth files
      const authFilesCheck = await this.checkAuthFiles();
      
      // Check DNS resolution
      const dnsCheck = await this.checkDNS();
      
      this.diagnosticResults = {
        timestamp: new Date().toISOString(),
        webWhatsappReachable: webWhatsappCheck.success,
        authFilesExist: authFilesCheck.success,
        dnsResolution: dnsCheck.success,
        details: {
          webWhatsapp: webWhatsappCheck,
          authFiles: authFilesCheck,
          dns: dnsCheck
        }
      };
      
      // Log and potentially notify about issues
      if (!webWhatsappCheck.success || !dnsCheck.success) {
        this.log(`Diagnostic warning: Network connectivity issues detected`);
        this.healthScore = Math.max(30, this.healthScore - 10);
      }
      
      if (!authFilesCheck.success && this.status !== ConnectionState.CONNECTING) {
        this.log(`Diagnostic warning: Authentication files missing or incomplete`);
        this.healthScore = Math.max(40, this.healthScore - 5);
      }
      
      return this.diagnosticResults;
    } catch (error) {
      this.log(`Diagnostics error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if a domain is reachable
   * @param {string} domain Domain to check
   * @returns {Promise<Object>} Result with success status
   */
  async checkDomain(domain) {
    try {
      const { stdout, stderr } = await execAsync(`ping -c 1 ${domain}`);
      return { 
        success: !stderr && stdout.includes('bytes from'), 
        details: stderr || stdout 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check DNS resolution
   * @returns {Promise<Object>} Result with success status
   */
  async checkDNS() {
    try {
      const { stdout, stderr } = await execAsync('nslookup web.whatsapp.com');
      return { 
        success: !stderr && stdout.includes('Address:'), 
        details: stderr || stdout 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if authentication files exist
   * @returns {Promise<Object>} Result with success status
   */
  async checkAuthFiles() {
    try {
      const authDir = path.join(process.cwd(), 'auth_info_baileys');
      
      if (!fs.existsSync(authDir)) {
        return { success: false, error: 'Auth directory does not exist' };
      }
      
      const files = await fs.promises.readdir(authDir);
      const hasCredsFile = files.includes('creds.json');
      
      return { 
        success: hasCredsFile, 
        filesCount: files.length,
        hasCredsFile
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Reconnect to WhatsApp with exponential backoff
   * @param {number|null} statusCode Status code from last disconnect
   */
  async reconnect(statusCode = null) {
    // If we were logged out, don't reconnect
    if (statusCode === 401 || statusCode === 403) {
      this.log("Not reconnecting due to authentication failure (logout)");
      this.status = ConnectionState.FAILED;
      return;
    }
    
    // Max reconnect attempts reached
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log(`Max reconnect attempts (${this.options.maxReconnectAttempts}) reached, giving up`);
      this.status = ConnectionState.FAILED;
      return;
    }
    
    this.reconnectAttempts++;
    this.status = ConnectionState.RECONNECTING;
    this.recoveryMode = true;
    
    // Calculate backoff delay using exponential backoff
    const delay = this.options.reconnectBackoffMs * Math.pow(2, this.reconnectAttempts - 1);
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
    
    // Wait for backoff delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Attempt reconnection - in a real implementation, this would restart the connection
    // For now, we'll just log that we'd restart
    this.log("Would restart connection now (simulation)");
    
    // In a real implementation, you would trigger your connection logic here
    // For example: 
    // this.sock = await makeWASocket(...);
    // this.setupEventListeners();
  }
  
  /**
   * Log a message and save to the log file
   * @param {string} message Message to log
   */
  log(message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      status: this.status,
      healthScore: this.healthScore
    };
    
    console.log(`[Connection Monitor] ${logEntry.timestamp} - ${message}`);
    this.logs.push(logEntry);
    
    // Keep logs at a reasonable size
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
    
    // Save logs to file (async, don't wait)
    this.saveLogs().catch(err => console.error('Error saving logs:', err));
  }
  
  /**
   * Save logs to the log file
   */
  async saveLogs() {
    try {
      const logData = {
        lastUpdated: new Date().toISOString(),
        status: this.status,
        healthScore: this.healthScore,
        reconnectAttempts: this.reconnectAttempts,
        diagnosticResults: this.diagnosticResults,
        logs: this.logs
      };
      
      await fs.promises.writeFile(
        this.options.logFilePath,
        JSON.stringify(logData, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Error saving logs:', error);
    }
  }
  
  /**
   * Get the current health status summary
   * @returns {Object} Health status summary
   */
  getHealthStatus() {
    return {
      status: this.status,
      healthScore: this.healthScore,
      reconnectAttempts: this.reconnectAttempts,
      lastSyncTime: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : null,
      monitoringActive: !!this.intervalId,
      lastErrors: this.lastErrors,
      diagnostics: this.diagnosticResults
    };
  }
  
  /**
   * Get all logs
   * @returns {Array} Log entries
   */
  getLogs() {
    return [...this.logs];
  }
}

module.exports = ConnectionMonitor;