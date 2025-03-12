const qrcode = require('qrcode-terminal');

// Generate a simple test QR code
console.clear();
qrcode.generate('Test QR Code', {}, (qr) => {
    console.log('If you can see a QR code below, your terminal supports QR display:\n');
    console.log('\n\n');
    console.log(qr);
});