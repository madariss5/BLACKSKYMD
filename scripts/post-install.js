/**
 * Post-install script for Heroku deployment
 * Sets up necessary directories and environment
 */

const fs = require('fs');
const path = require('path');

// Directories to create
const dirs = [
    'sessions',
    'auth_info_baileys',
    'temp',
    'logs'
];

// Create temp directories for Heroku
if (process.env.PLATFORM === 'heroku') {
    dirs.forEach(dir => {
        const dirPath = path.join('/tmp', dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        }
    });
}

// Create local directories
dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
});

console.log('Post-install setup completed successfully');
