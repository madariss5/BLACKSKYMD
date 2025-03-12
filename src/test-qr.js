const qrcode = require('qrcode-terminal');

// Generate a simple test QR code
console.clear();
qrcode.generate('Test QR Code', { small: true }, (qr) => {
    console.log('If you can see a QR code below, your terminal supports QR display:\n');
    console.log(qr);
});
