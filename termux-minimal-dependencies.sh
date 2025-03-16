#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Minimal Dependency Installer for Termux
# Simplified version with only essential dependencies

echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Minimal Dependency Installer"
echo "==============================================="

# Update package list
echo "Updating package lists..."
pkg update -y

# Install only the absolutely essential packages
echo "Installing core packages..."
pkg install -y nodejs git ffmpeg wget

# Create necessary directories
mkdir -p src/utils/polyfills

# Create a minimal canvas polyfill
echo "Creating polyfills for missing libraries..."
cat > src/utils/polyfills/canvas-polyfill.js << 'EOL'
/**
 * Minimal Canvas Polyfill
 */
class CanvasReplacement {
    constructor(width = 200, height = 200) {
        this.width = width;
        this.height = height;
        console.log('Canvas not available in Termux, using text-only fallback');
    }
    
    getContext() {
        return {
            fillRect: () => {},
            clearRect: () => {},
            drawImage: () => {},
            fillText: () => {},
            measureText: (text) => ({ width: text.length * 5 })
        };
    }
    
    toBuffer() {
        return Buffer.from('dummy');
    }
}

module.exports = CanvasReplacement;
module.exports.createCanvas = (w, h) => new CanvasReplacement(w, h);
module.exports.loadImage = () => Promise.resolve({ width: 10, height: 10 });
EOL

# Create a minimal sharp polyfill
cat > src/utils/polyfills/sharp-polyfill.js << 'EOL'
/**
 * Minimal Sharp Polyfill
 */
const fs = require('fs');

function createPolyfill(input) {
    return {
        resize: () => createPolyfill(input),
        jpeg: () => createPolyfill(input),
        png: () => createPolyfill(input),
        webp: () => createPolyfill(input),
        toBuffer: async () => {
            if (typeof input === 'string' && fs.existsSync(input)) {
                return fs.promises.readFile(input);
            }
            return input instanceof Buffer ? input : Buffer.from('dummy');
        },
        toFile: async (path) => {
            const buffer = await createPolyfill(input).toBuffer();
            await fs.promises.writeFile(path, buffer);
            return { width: 10, height: 10 };
        }
    };
}

module.exports = createPolyfill;
EOL

# Create the polyfill loader
cat > src/use-polyfills.js << 'EOL'
/**
 * Termux Polyfill Loader
 */

// Patch require to handle missing dependencies
const origRequire = module.require;
const path = require('path');

function patchedRequire(id) {
    try {
        return origRequire.call(this, id);
    } catch (err) {
        // Special handling for known problematic modules
        if (id === 'canvas') {
            return origRequire.call(this, path.join(__dirname, 'utils/polyfills/canvas-polyfill.js'));
        }
        if (id === 'sharp') {
            return origRequire.call(this, path.join(__dirname, 'utils/polyfills/sharp-polyfill.js'));
        }
        throw err;
    }
}

// Apply the patch
module.require = patchedRequire;
console.log('Termux polyfills enabled');
EOL

# Update termux-connection.js to use polyfills if it exists
if [ -f "src/termux-connection.js" ]; then
    if ! grep -q "require('./use-polyfills')" "src/termux-connection.js"; then
        # Create a temporary file with the new contents
        echo "// Use Termux polyfills for missing dependencies" > temp_file
        echo "require('./use-polyfills');" >> temp_file
        echo "" >> temp_file
        cat "src/termux-connection.js" >> temp_file
        # Replace the original file
        mv temp_file "src/termux-connection.js"
        echo "Added polyfill support to termux-connection.js"
    else
        echo "Polyfills already enabled in termux-connection.js"
    fi
else
    echo "Warning: termux-connection.js not found. Will need to be manually updated."
fi

# Install only the essential NPM packages
echo "Installing core NPM dependencies..."
npm install --no-optional @whiskeysockets/baileys qrcode-terminal pino pino-pretty

echo "==============================================="
echo "  Minimal dependencies installed!"
echo "==============================================="
echo "To start the bot, run:"
echo "  node src/termux-connection.js"
echo "==============================================="