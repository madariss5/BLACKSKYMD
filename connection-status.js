/**
 * WhatsApp Connection Status Dashboard
 * 
 * This script provides a comprehensive view of all connection methods
 * and their current status, helping diagnose connection issues in the
 * Replit environment.
 */

const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const dns = require('dns').promises;
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5090;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));

// Helper functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validate credentials file
async function validateCredsFile(folderPath) {
  try {
    const credsPath = path.join(folderPath, 'creds.json');
    try {
      await fs.access(credsPath);
    } catch {
      return false;
    }
    
    const data = await fs.readFile(credsPath, 'utf8');
    const creds = JSON.parse(data);
    return creds && creds.me && creds.me.id && creds.noiseKey;
  } catch (error) {
    return false;
  }
}

// Get system information
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    platform: `${os.platform()} ${os.arch()}`,
    nodeVersion: process.version,
    memory: `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${Math.round(usedMem / totalMem * 100)}% used)`,
    uptime: formatUptime(os.uptime()),
    isReplit: 'REPL_ID' in process.env || 'REPLIT_ENVIRONMENT' in process.env
  };
}

function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Test network connectivity
async function testNetwork() {
  const endpoints = [
    { name: 'web.whatsapp.com', url: 'https://web.whatsapp.com', type: 'https' },
    { name: 'WhatsApp WebSocket', url: 'wss://web.whatsapp.com/ws', type: 'dns' },
    { name: 'WhatsApp Media', url: 'https://mmg.whatsapp.net', type: 'https' },
    { name: 'Primary DNS', url: 'web.whatsapp.com', type: 'dns' },
    { name: 'Google DNS', url: '8.8.8.8', type: 'ping' }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      let success = false;
      
      switch (endpoint.type) {
        case 'https':
          await new Promise((resolve, reject) => {
            const req = https.get(endpoint.url, { timeout: 5000 }, (res) => {
              success = res.statusCode >= 200 && res.statusCode < 400;
              res.on('data', () => {});
              res.on('end', resolve);
            });
            req.on('error', reject);
            req.end();
          }).catch(() => {});
          break;
          
        case 'dns':
          await dns.lookup(endpoint.url.replace(/^(wss?|https?):\/\//, ''));
          success = true;
          break;
          
        case 'ping':
          await new Promise((resolve) => {
            exec(`ping -c 1 ${endpoint.url}`, (error) => {
              success = !error;
              resolve();
            });
          });
          break;
      }
      
      const latency = Date.now() - startTime;
      results.push({ 
        endpoint: endpoint.name, 
        success, 
        latency: success ? latency : '-'
      });
    } catch (error) {
      results.push({ 
        endpoint: endpoint.name, 
        success: false, 
        latency: '-',
        error: error.message
      });
    }
  }
  
  return results;
}

// Get error logs from connection and pairing attempts
async function getErrorLogs() {
  const logs = [];
  try {
    // Check for log files in common locations
    const logLocations = [
      'connection.log',
      'logs/connection.log',
      'pairing.log',
      'logs/pairing.log',
      'auth_info_pairing/pairing.log'
    ];
    
    for (const logFile of logLocations) {
      try {
        const content = await fs.readFile(logFile, 'utf8');
        const errorLines = content.split('\n')
          .filter(line => line.includes('ERROR') || line.includes('Error:') || line.includes('Connection closed'))
          .slice(-5); // Last 5 errors

        for (const line of errorLines) {
          logs.push({
            time: new Date().toISOString(),
            message: line.trim()
          });
        }
      } catch (error) {
        // Skip file if it doesn't exist
      }
    }
    
    // Also check for running workflows error output
    const workflowsDir = '.';
    let files = [];
    try {
      files = await fs.readdir(workflowsDir);
    } catch (error) {
      // Handle directory read error
    }
    
    // Run process checks in parallel
    const checkPromises = [];
    for (const file of files) {
      if (file.endsWith('.js') && ['pairing-code-generator.js', 'connected-bot.js', 'safari-connect.js'].includes(file)) {
        checkPromises.push(
          new Promise((resolve) => {
            exec(`ps aux | grep "${file}" | grep -v grep`, (error, stdout) => {
              if (stdout) {
                logs.push({
                  time: new Date().toISOString(),
                  message: `Process running: ${file}`
                });
              }
              resolve();
            });
          })
        );
      }
    }
    
    // Wait for all process checks to complete
    await Promise.all(checkPromises);
    
    // Add any manually known errors
    logs.push({
      time: new Date().toISOString(),
      message: "Common error: 'Connection Failure (Status code: 405)' - This is a WhatsApp server-side block on connection attempts"
    });
    
    logs.push({
      time: new Date().toISOString(),
      message: "Remedy: Change browser fingerprint or use pairing code authentication"
    });
    
  } catch (error) {
    logs.push({
      time: new Date().toISOString(),
      message: `Error retrieving logs: ${error.message}`
    });
  }
  
  return logs;
}

// Get connection method status
async function getConnectionMethods() {
  const methods = {
    'WhatsApp Bot': { active: false, message: 'Not connected', error: null },
    'Terminal QR': { active: false, message: 'Not connected', error: null },
    'Web QR': { active: false, message: 'Not connected', error: null },
    'Pairing Code': { active: false, message: 'Not connected', error: null, environment: 'Cloud' },
    'Safari Connect': { active: false, message: 'Not connected', error: null, environment: 'Cloud' },
    'Connected Bot': { active: false, message: 'Not connected', error: null, environment: 'Unified' }
  };
  
  // Check process status for different workflows
  const checkProcess = async (name, fileName) => {
    return new Promise((resolve) => {
      exec(`ps aux | grep "${fileName}" | grep -v grep`, (error, stdout) => {
        if (!error && stdout) {
          methods[name].active = true;
          methods[name].message = 'Running';
        }
        resolve();
      });
    });
  };
  
  // Run process checks in parallel
  await Promise.all([
    checkProcess('WhatsApp Bot', 'src/index.js'),
    checkProcess('Terminal QR', 'src/terminal-qr.js'),
    checkProcess('Web QR', 'src/web-qr.js'),
    checkProcess('Pairing Code', 'pairing-code-generator.js'),
    checkProcess('Safari Connect', 'safari-connect.js'),
    checkProcess('Connected Bot', 'connected-bot.js')
  ]);
  
  // Check auth folders
  const checkAuth = async (name, folderName) => {
    try {
      const exists = await fs.access(folderName).then(() => true).catch(() => false);
      
      if (exists) {
        const credsExists = await fs.access(`${folderName}/creds.json`).then(() => true).catch(() => false);
        
        if (credsExists) {
          methods[name].message = 'Authenticated';
          methods[name].active = true;
        } else {
          methods[name].message = 'Auth folder exists but no credentials';
        }
      }
    } catch (error) {
      // Ignore errors
    }
  };
  
  // Run auth checks in parallel
  await Promise.all([
    checkAuth('WhatsApp Bot', 'auth_info_baileys'),
    checkAuth('Terminal QR', 'auth_info_terminal'),
    checkAuth('Web QR', 'auth_info_web'),
    checkAuth('Pairing Code', 'auth_info_pairing'),
    checkAuth('Safari Connect', 'auth_info_safari'),
    checkAuth('Connected Bot', 'auth_info_baileys')
  ]);
  
  // Check for known error patterns
  const checkErrorPattern = async (name, errorPattern) => {
    try {
      const logLocations = [
        'connection.log',
        'logs/connection.log',
        'pairing.log'
      ];
      
      for (const logFile of logLocations) {
        try {
          const content = await fs.readFile(logFile, 'utf8');
          if (content.includes(errorPattern)) {
            methods[name].error = errorPattern;
            methods[name].message = `Error: ${errorPattern}`;
            break;
          }
        } catch (error) {
          // Skip file if it doesn't exist
        }
      }
    } catch (error) {
      // Ignore error
    }
  };
  
  // Run error pattern checks in parallel
  await Promise.all([
    checkErrorPattern('WhatsApp Bot', 'Connection Failure (Status code: 405)'),
    checkErrorPattern('Pairing Code', 'Connection Failure (Status code: 405)'),
    checkErrorPattern('Safari Connect', 'Connection Failure (Status code: 405)')
  ]);
  
  return methods;
}

async function getAuthenticationStatus() {
  const authFolders = [
    { name: 'Main Bot Auth', path: 'auth_info_baileys' },
    { name: 'Terminal QR Auth', path: 'auth_info_terminal' },
    { name: 'Web QR Auth', path: 'auth_info_web' },
    { name: 'Pairing Code Auth', path: 'auth_info_pairing' },
    { name: 'Safari Browser Auth', path: 'auth_info_safari' },
    { name: 'Connected Bot Auth', path: 'auth_info_baileys_qr' }
  ];
  
  const results = [];
  
  for (const folder of authFolders) {
    try {
      const exists = await fs.access(folder.path).then(() => true).catch(() => false);
      let files = [];
      let valid = false;
      let message = 'Auth folder not found';
      
      if (exists) {
        files = await fs.readdir(folder.path);
        valid = files.includes('creds.json');
        message = valid ? 'Valid authentication data' : 'Credentials incomplete';
      }
      
      results.push({
        name: folder.name,
        exists,
        valid,
        files,
        message
      });
    } catch (error) {
      results.push({
        name: folder.name,
        exists: false,
        valid: false,
        files: [],
        message: `Error checking auth: ${error.message}`
      });
    }
  }
  
  return results;
}

// Routes
app.get('/', async (req, res) => {
  try {
    const [networkTests, authFolders, connectionMethods, errorLogs] = await Promise.all([
      testNetwork(),
      getAuthenticationStatus(),
      getConnectionMethods(),
      getErrorLogs()
    ]);
    
    const systemInfo = getSystemInfo();
    
    res.render('status', {
      networkTests,
      authFolders, 
      connectionMethods,
      errorLogs,
      systemInfo
    });
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/clear-auth', async (req, res) => {
  const authFolders = [
    'auth_info_baileys',
    'auth_info_terminal',
    'auth_info_web',
    'auth_info_pairing',
    'auth_info_safari',
    'auth_info_baileys_qr'
  ];
  
  const clearPromises = authFolders.map(folder => 
    fs.rm(folder, { recursive: true, force: true }).catch(() => {
      // Ignore errors for folders that don't exist
    })
  );
  
  await Promise.all(clearPromises);
  
  res.redirect('/');
});

app.get('/test-network', async (req, res) => {
  try {
    const results = await testNetwork();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/logs', async (req, res) => {
  try {
    const logs = await getErrorLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Status dashboard running on http://localhost:${PORT}`);
});