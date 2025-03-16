/**
 * Keep-Alive Server
 * 
 * This module creates a simple HTTP server that can be used to keep your Replit
 * project alive by responding to pings from services like UptimeRobot.
 * 
 * It also provides status information about your bot when you visit the page.
 */

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('./logger');

// Track uptime and connection status
let startTime = Date.now();
let connectionState = 'disconnected';
let lastPingTime = null;
let totalPings = 0;
let qrGenerated = 0;
let reconnectAttempts = 0;

// Reference to the WhatsApp socket
let sock = null;

/**
 * Set the WhatsApp socket reference
 * @param {Object} whatsappSock The WhatsApp socket
 */
function setSocket(whatsappSock) {
    sock = whatsappSock;
}

/**
 * Update the connection state
 * @param {string} state The new connection state
 */
function updateConnectionState(state) {
    connectionState = state;
}

/**
 * Increment the QR code generation counter
 */
function incrementQrGenerated() {
    qrGenerated++;
}

/**
 * Increment the reconnect attempts counter
 */
function incrementReconnectAttempts() {
    reconnectAttempts++;
}

/**
 * Reset counters on successful connection
 */
function resetCounters() {
    qrGenerated = 0;
    reconnectAttempts = 0;
}

/**
 * Start the keep-alive HTTP server
 * @param {number} port Port to listen on (default: 3000)
 */
function startServer(port = 3000) {
    const server = http.createServer(async (req, res) => {
        try {
            // Record ping
            lastPingTime = new Date().toISOString();
            totalPings++;
            
            // Set headers
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            
            // Generate system stats
            const uptime = formatUptime(Date.now() - startTime);
            const memoryUsage = process.memoryUsage();
            const freeMemory = os.freemem() / (1024 * 1024);
            const totalMemory = os.totalmem() / (1024 * 1024);
            
            // Check for auth files
            const authDirs = [
                './auth_info_baileys',
                './auth_info_baileys_backup',
                './backups',
                './data/session_backups'
            ];
            
            const backupInfo = [];
            
            for (const dir of authDirs) {
                try {
                    const exists = await fileExists(dir);
                    if (exists) {
                        const files = await fs.readdir(dir);
                        const credFiles = files.filter(file => 
                            file.includes('creds') || 
                            file.includes('session') || 
                            file.includes('backup')
                        );
                        
                        if (credFiles.length > 0) {
                            const latestFile = credFiles[credFiles.length - 1];
                            const stats = await fs.stat(path.join(dir, latestFile));
                            backupInfo.push({
                                dir,
                                files: credFiles.length,
                                latest: latestFile,
                                time: stats.mtime.toISOString()
                            });
                        } else {
                            backupInfo.push({ dir, files: 0 });
                        }
                    } else {
                        backupInfo.push({ dir, exists: false });
                    }
                } catch (err) {
                    backupInfo.push({ dir, error: err.message });
                }
            }
            
            // Check WhatsApp connection
            let whatsappStatus = 'Socket not initialized';
            if (sock) {
                whatsappStatus = connectionState || 'unknown';
            }
            
            // Generate HTML page
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot Status</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    h1, h2 {
                        color: #4CAF50;
                    }
                    .status {
                        padding: 10px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                    }
                    .online {
                        background-color: #dff0d8;
                        border: 1px solid #3c763d;
                    }
                    .offline {
                        background-color: #f2dede;
                        border: 1px solid #a94442;
                    }
                    .connecting {
                        background-color: #fcf8e3;
                        border: 1px solid #8a6d3b;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    .ping-count {
                        padding: 4px 8px;
                        border-radius: 12px;
                        background-color: #4CAF50;
                        color: white;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <h1>WhatsApp Bot Status</h1>
                
                <div class="status ${whatsappStatus === 'open' ? 'online' : whatsappStatus === 'connecting' ? 'connecting' : 'offline'}">
                    <h2>Connection Status: ${whatsappStatus}</h2>
                    <p>Server Uptime: ${uptime}</p>
                    <p>QR Codes Generated: ${qrGenerated}</p>
                    <p>Reconnection Attempts: ${reconnectAttempts}</p>
                </div>
                
                <h2>System Information</h2>
                <table>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>Memory Usage (RSS)</td>
                        <td>${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB</td>
                    </tr>
                    <tr>
                        <td>Heap Used</td>
                        <td>${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</td>
                    </tr>
                    <tr>
                        <td>System Memory</td>
                        <td>${freeMemory.toFixed(2)} MB free of ${totalMemory.toFixed(2)} MB</td>
                    </tr>
                    <tr>
                        <td>Platform</td>
                        <td>${os.platform()} (${os.type()} ${os.release()})</td>
                    </tr>
                    <tr>
                        <td>Node.js Version</td>
                        <td>${process.version}</td>
                    </tr>
                </table>
                
                <h2>Backup Information</h2>
                <table>
                    <tr>
                        <th>Directory</th>
                        <th>Files</th>
                        <th>Latest Backup</th>
                    </tr>
                    ${backupInfo.map(info => `
                    <tr>
                        <td>${info.dir}</td>
                        <td>${info.files !== undefined ? info.files : (info.exists === false ? 'Directory not found' : 'Error')}</td>
                        <td>${info.latest ? `${info.latest} (${formatTime(new Date(info.time))})` : 'N/A'}</td>
                    </tr>
                    `).join('')}
                </table>
                
                <h2>Monitoring Stats</h2>
                <p>Total Pings: <span class="ping-count">${totalPings}</span></p>
                <p>Last Ping: ${lastPingTime ? formatTime(new Date(lastPingTime)) : 'Never'}</p>
                
                <footer>
                    <p>Generated at: ${new Date().toISOString()}</p>
                    <p>BLACKSKY-MD WhatsApp Bot</p>
                </footer>
            </body>
            </html>
            `;
            
            res.writeHead(200);
            res.end(html);
        } catch (error) {
            logger.error('Error in keep-alive server:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    });
    
    server.listen(port, () => {
        logger.info(`Keep-alive server running on port ${port}`);
    });
    
    return server;
}

/**
 * Format uptime into a human-readable string
 * @param {number} ms Uptime in milliseconds
 * @returns {string} Formatted uptime
 */
function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Format a date into a human-readable string
 * @param {Date} date Date to format
 * @returns {string} Formatted date
 */
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    // Less than a minute
    if (diff < 60000) {
        return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    // Format as date
    return date.toLocaleString();
}

/**
 * Check if a file or directory exists
 * @param {string} path Path to check
 * @returns {Promise<boolean>} Whether the file or directory exists
 */
async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    startServer,
    setSocket,
    updateConnectionState,
    incrementQrGenerated,
    incrementReconnectAttempts,
    resetCounters
};