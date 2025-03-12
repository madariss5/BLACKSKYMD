const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();

// Set up a test QR code display server on port 5001 (different from the main bot)
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Test QR Code</title>
                <style>
                    body { 
                        display: flex; 
                        flex-direction: column;
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        margin: 0;
                        font-family: Arial, sans-serif;
                        background: #f0f2f5;
                    }
                    #qrcode {
                        padding: 20px;
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h2 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    .status {
                        margin-top: 20px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <h2>QR Code Test</h2>
                <div id="qrcode">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TestQRCode" alt="Test QR Code"/>
                </div>
                <p class="status">This is a test QR code to verify display functionality</p>
            </body>
        </html>
    `);
});

// Generate a simple test QR code in terminal
console.clear();
qrcode.generate('Test QR Code', {small: true}, (qr) => {
    console.log('If you can see a QR code below, your terminal supports QR display:\n');
    console.log(qr);
    console.log('\nAlso starting a web server for browser testing...');
});

// Start web server on port 5001 (different from the main bot port 5000)
const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nQR Code test server running at http://localhost:${PORT}`);
});