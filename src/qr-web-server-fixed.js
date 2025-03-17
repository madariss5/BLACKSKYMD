/**
 * WhatsApp QR Web Server and Connection Manager
 * Enhanced with session replacement protection
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { connect, getCurrentQR, getConnectionStatus, getSocket } = require('./connection');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// View settings
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Create views directory if it doesn't exist
const viewsDir = path.join(__dirname, '../views');
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

// Create the EJS template for QR display
const qrTemplatePath = path.join(viewsDir, 'qr.ejs');
if (!fs.existsSync(qrTemplatePath)) {
  const qrTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BLACKSKY-MD WhatsApp QR Scanner</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #f0f0f0;
            padding: 20px;
            color: #333;
        }
        h1 {
            color: #128C7E;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        #qrcode {
            padding: 20px;
            background-color: white;
            display: inline-block;
            margin: 20px 0;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            font-weight: bold;
        }
        .connected {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .disconnected {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .waiting {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        .instructions {
            text-align: left;
            margin: 20px 0;
            padding: 15px;
            background-color: #e7f3fe;
            border-left: 5px solid #2196F3;
            border-radius: 3px;
        }
        .info {
            font-size: 0.9em;
            color: #666;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BLACKSKY-MD WhatsApp</h1>
        
        <div id="statusContainer">
            <div class="status waiting" id="status">Waiting for QR Code...</div>
        </div>
        
        <div id="qrcontainer">
            <div id="qrcode"></div>
        </div>
        
        <div class="instructions">
            <h3>How to connect:</h3>
            <ol>
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu or Settings and select Linked Devices</li>
                <li>Tap on "Link a Device"</li>
                <li>Point your phone to this screen to scan the QR code</li>
            </ol>
        </div>
        
        <div class="info">
            <p>This connection is secure and uses WhatsApp's official multi-device API.</p>
            <p>The QR code refreshes automatically when needed. Keep this page open.</p>
            <p><small>BLACKSKY-MD v1.0.0</small></p>
        </div>
    </div>

    <script>
        const socket = new WebSocket('ws://' + window.location.host);
        const qrElement = document.getElementById('qrcode');
        const statusElement = document.getElementById('status');
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'qr') {
                qrElement.innerHTML = data.qr;
                statusElement.className = 'status waiting';
                statusElement.innerText = 'Scan this QR code with WhatsApp';
            } else if (data.type === 'connection') {
                if (data.connected) {
                    qrElement.innerHTML = '<img src="/success.svg" width="200" height="200" />';
                    statusElement.className = 'status connected';
                    statusElement.innerText = 'Connected Successfully!';
                } else {
                    statusElement.className = 'status disconnected';
                    statusElement.innerText = 'Disconnected: ' + (data.reason || 'Unknown reason');
                }
            } else if (data.type === 'status') {
                statusElement.innerText = data.message;
            }
        };
        
        socket.onclose = function() {
            statusElement.className = 'status disconnected';
            statusElement.innerText = 'Server connection lost. Please refresh the page.';
        };
    </script>
</body>
</html>`;
  fs.writeFileSync(qrTemplatePath, qrTemplate);
}

// Create success SVG for connected state
const successSvgPath = path.join(__dirname, '../public/success.svg');
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(successSvgPath)) {
  const successSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="90" fill="#4CAF50" />
  <path d="M83.5 136.5l-42-42 12-12 30 30 63-63 12 12z" fill="white" />
</svg>`;
  fs.writeFileSync(successSvgPath, successSvg);
}

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => {
  res.render('qr');
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send current connection status to the new client
  const status = getConnectionStatus();
  ws.send(JSON.stringify({
    type: 'connection',
    connected: status.isConnected,
    reason: status.lastDisconnectReason
  }));

  // If QR code is available, send it
  const currentQr = getCurrentQR();
  if (currentQr && !status.isConnected) {
    qrcode.toDataURL(currentQr, (err, url) => {
      if (!err) {
        ws.send(JSON.stringify({
          type: 'qr',
          qr: `<img src="${url}" width="256" height="256" />`
        }));
      }
    });
  }
});

// Broadcast to all connected clients
function broadcastToClients(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Start the WhatsApp connection and web server
 */
async function startServer() {
  const PORT = process.env.PORT || 5000;
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });

  // Connect to WhatsApp
  try {
    const sock = await connect({ 
      printQR: false,
    });

    // Set up QR code monitoring
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrcode.toDataURL(qr, (err, url) => {
          if (!err) {
            broadcastToClients({
              type: 'qr',
              qr: `<img src="${url}" width="256" height="256" />`
            });
            broadcastToClients({
              type: 'status',
              message: 'Scan this QR code with WhatsApp'
            });
          }
        });
      }
      
      if (connection === 'close') {
        const shouldReconnect = 
          lastDisconnect?.error?.output?.statusCode !== 440;
          
        broadcastToClients({
          type: 'connection',
          connected: false,
          reason: lastDisconnect?.error?.message || 'Connection closed'
        });
        
        if (shouldReconnect) {
          broadcastToClients({
            type: 'status',
            message: 'Reconnecting...'
          });
          
          // Reconnect after a short delay
          setTimeout(() => startServer(), 3000);
        }
      } else if (connection === 'open') {
        broadcastToClients({
          type: 'connection',
          connected: true
        });
        
        broadcastToClients({
          type: 'status',
          message: 'Connected to WhatsApp'
        });
      }
    });
    
    // Handle messages (can be extended as needed)
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        // Message handling can be added here
        console.log('New message received');
      }
    });
    
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

// Start the server
startServer();