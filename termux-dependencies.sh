#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Dependency Installer for Termux
# This script installs all required dependencies for running the bot on Termux

# Display banner
echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Dependency Installer"
echo "==============================================="

# Function to check if a package is installed
check_package() {
    if ! command -v "$1" &> /dev/null; then
        echo "Installing $1..."
        pkg install -y "$1"
    else
        echo "Package $1 is already installed."
    fi
}

# Install required packages
echo "Installing system dependencies..."
pkg update -y
pkg upgrade -y

# Core packages
check_package "nodejs"
check_package "git"
check_package "wget"
check_package "python"
check_package "make"
check_package "clang"
check_package "pkg-config"
check_package "ffmpeg"
check_package "libjpeg-turbo"
check_package "libpng"
check_package "librsvg"
check_package "pngquant"
check_package "ndk-sysroot"
check_package "build-essential"
check_package "libtool"
check_package "autoconf"
check_package "automake"

# Install required build tools for Sharp and Canvas
echo "Installing build dependencies for Sharp and Canvas..."
pkg install -y python3 python-numpy libjpeg-turbo libpng x11-repo pango

# Create installation log
INSTALL_LOG="dependency_install.log"
echo "Starting dependency installation at $(date)" > "$INSTALL_LOG"

# Create a workaround package.json with simplified dependencies
echo "Creating a Termux-compatible package.json..."
cat > package.json.termux << 'EOL'
{
  "name": "blacksky-md-termux",
  "version": "1.0.0",
  "description": "BLACKSKY-MD WhatsApp Bot for Termux",
  "main": "src/termux-connection.js",
  "scripts": {
    "start": "node src/termux-connection.js"
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.5.0",
    "qrcode-terminal": "^0.12.0",
    "qrcode": "^1.5.1",
    "express": "^4.18.2",
    "pino": "^8.14.1",
    "pino-pretty": "^10.0.0",
    "moment-timezone": "^0.5.43",
    "moment": "^2.29.4",
    "jimp": "^0.22.8",
    "fluent-ffmpeg": "^2.1.2",
    "node-cache": "^5.1.2",
    "axios": "^1.4.0",
    "chalk": "^4.1.2",
    "adm-zip": "^0.5.10",
    "file-type": "^18.5.0",
    "path": "^0.12.7",
    "fs": "^0.0.1-security",
    "util": "^0.12.5",
    "os": "^0.1.2",
    "crypto": "^1.0.1",
    "node-cron": "^3.0.2",
    "ejs": "^3.1.9",
    "ws": "^8.13.0"
  },
  "optionalDependencies": {
    "canvas": "^2.11.2",
    "sharp": "^0.32.6"
  }
}
EOL

# Create a minimal canvas replacement script for graceful degradation
mkdir -p src/utils/polyfills
cat > src/utils/polyfills/canvas-polyfill.js << 'EOL'
/**
 * Canvas Polyfill for Termux
 * This is a minimal implementation that provides fallback functionality
 * when the canvas module is not available
 */

class CanvasPolyfill {
    constructor(width = 200, height = 200) {
        this.width = width;
        this.height = height;
        console.log(`Canvas polyfill created (${width}x${height})`);
    }

    getContext(type) {
        if (type !== '2d') {
            throw new Error('Only 2d context is supported in polyfill');
        }
        return new ContextPolyfill(this);
    }

    toBuffer() {
        // Return an empty PNG buffer (1x1 black pixel)
        return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdwI2Q4tNiAAAAABJRU5ErkJggg==', 'base64');
    }
    
    toDataURL() {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdwI2Q4tNiAAAAABJRU5ErkJggg==';
    }
    
    createPNGStream() {
        const { Readable } = require('stream');
        const stream = new Readable();
        stream.push(this.toBuffer());
        stream.push(null);
        return stream;
    }
}

class ContextPolyfill {
    constructor(canvas) {
        this.canvas = canvas;
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.font = '10px sans-serif';
        this.lineWidth = 1;
        this.textAlign = 'start';
        this.textBaseline = 'alphabetic';
    }

    fillRect() {}
    strokeRect() {}
    clearRect() {}
    beginPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    fill() {}
    stroke() {}
    fillText(text, x, y) {
        console.log(`Canvas polyfill: would draw text "${text}" at ${x},${y}`);
    }
    strokeText() {}
    measureText(text) {
        return { width: text.length * 5 };
    }
    arc() {}
    drawImage() {
        console.log('Canvas polyfill: image drawing not supported');
    }
}

// Check if the real canvas module is available
try {
    const Canvas = require('canvas');
    console.log('Real canvas module found, using that instead of polyfill');
    module.exports = Canvas;
} catch (err) {
    console.log('Canvas module not available, using polyfill instead');
    // Export our polyfill
    module.exports = CanvasPolyfill;
    module.exports.createCanvas = (width, height) => new CanvasPolyfill(width, height);
    module.exports.loadImage = async () => ({
        width: 1,
        height: 1
    });
}
EOL

# Create sharp polyfill
cat > src/utils/polyfills/sharp-polyfill.js << 'EOL'
/**
 * Sharp Polyfill for Termux
 * Provides minimal functionality when the sharp module is not available
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

class SharpPolyfill {
    constructor(input) {
        this.input = input;
        this.operations = [];
        this.format = 'jpeg';
        this.quality = 80;
        console.log('Sharp polyfill: created instance');
    }

    resize(width, height, options = {}) {
        this.operations.push({ type: 'resize', width, height, options });
        return this;
    }

    rotate(angle, options = {}) {
        this.operations.push({ type: 'rotate', angle, options });
        return this;
    }

    flip(flip = true) {
        this.operations.push({ type: 'flip', flip });
        return this;
    }

    flop(flop = true) {
        this.operations.push({ type: 'flop', flop });
        return this;
    }

    sharpen(sigma = 1, flat = 1, jagged = 2) {
        this.operations.push({ type: 'sharpen', sigma, flat, jagged });
        return this;
    }

    blur(sigma = 1) {
        this.operations.push({ type: 'blur', sigma });
        return this;
    }

    gamma(gamma = 2.2) {
        this.operations.push({ type: 'gamma', gamma });
        return this;
    }

    negate(negate = true) {
        this.operations.push({ type: 'negate', negate });
        return this;
    }

    jpeg(options = {}) {
        this.format = 'jpeg';
        this.quality = options.quality || 80;
        return this;
    }

    png(options = {}) {
        this.format = 'png';
        this.compressionLevel = options.compressionLevel || 6;
        return this;
    }

    webp(options = {}) {
        this.format = 'webp';
        this.quality = options.quality || 80;
        return this;
    }

    gif(options = {}) {
        this.format = 'gif';
        return this;
    }

    toBuffer() {
        console.log(`Sharp polyfill: would process image with ${this.operations.length} operations, format=${this.format}`);
        
        // Just pass through the input buffer if it's a buffer
        if (Buffer.isBuffer(this.input)) {
            return Promise.resolve(this.input);
        }
        
        // If input is a file path, read the file
        if (typeof this.input === 'string') {
            return readFileAsync(this.input);
        }
        
        // Default empty buffer
        return Promise.resolve(Buffer.from(''));
    }

    toFile(outputPath) {
        return this.toBuffer()
            .then(buffer => writeFileAsync(outputPath, buffer))
            .then(() => ({ 
                format: this.format,
                width: 100, 
                height: 100,
                channels: 3,
                size: 1000
            }));
    }
}

// Check if the real sharp module is available
try {
    const sharp = require('sharp');
    console.log('Real sharp module found, using that instead of polyfill');
    module.exports = sharp;
} catch (err) {
    console.log('Sharp module not available, using polyfill instead');
    // Export our polyfill function
    module.exports = (input) => new SharpPolyfill(input);
    module.exports.cache = false;
    module.exports.simd = false;
    module.exports.format = { 
        jpeg: { id: 'jpeg', input: { file: true } },
        png: { id: 'png', input: { file: true } },
        webp: { id: 'webp', input: { file: true } },
        gif: { id: 'gif', input: { file: true } }
    };
}
EOL

# Create a module loader patcher
cat > src/utils/termux-module-loader.js << 'EOL'
/**
 * Termux Module Loader
 * This module patches require() to handle missing dependencies gracefully in Termux
 */

const originalRequire = module.require;
const path = require('path');
const fs = require('fs');

function patchedRequire(moduleName) {
    try {
        // First try the normal require
        return originalRequire.call(this, moduleName);
    } catch (err) {
        // Check if we have a polyfill for this module
        const currentDir = path.dirname(module.filename);
        const polyfillPath = path.join(currentDir, '..', 'utils', 'polyfills', `${moduleName}-polyfill.js`);
        
        if (fs.existsSync(polyfillPath)) {
            console.log(`Module '${moduleName}' not found, using polyfill from ${polyfillPath}`);
            return originalRequire.call(this, polyfillPath);
        }
        
        // For canvas and sharp, use our polyfills
        if (moduleName === 'canvas') {
            return originalRequire.call(this, path.join(currentDir, '..', 'utils', 'polyfills', 'canvas-polyfill.js'));
        }
        
        if (moduleName === 'sharp') {
            return originalRequire.call(this, path.join(currentDir, '..', 'utils', 'polyfills', 'sharp-polyfill.js'));
        }
        
        // No polyfill available, rethrow the error
        throw err;
    }
}

// Patch the require function
module.require = patchedRequire;

// Export a function to restore the original behavior if needed
module.exports = {
    restore: function() {
        module.require = originalRequire;
    }
};
EOL

# Create use instructions for our polyfills
cat > src/use-polyfills.js << 'EOL'
/**
 * Use this at the start of your main file to enable module polyfills for Termux
 * Example: require('./use-polyfills');
 */

// Patch require to use our polyfills for missing modules
require('./utils/termux-module-loader');

// Log that polyfills are enabled
console.log('Termux module polyfills enabled - fallbacks available for missing dependencies');
EOL

# Update termux-connection.js to use polyfills
TERMUX_CONNECTION="src/termux-connection.js"
if [ -f "$TERMUX_CONNECTION" ]; then
    # Check if polyfill is already loaded
    if ! grep -q "require('./use-polyfills')" "$TERMUX_CONNECTION"; then
        # Add polyfill loader at the top after the first require
        echo "// Use Termux polyfills for missing dependencies" > temp_file
        echo "require('./use-polyfills');" >> temp_file
        echo "" >> temp_file
        cat "$TERMUX_CONNECTION" >> temp_file
        mv temp_file "$TERMUX_CONNECTION"
        echo "Updated $TERMUX_CONNECTION to use polyfills."
    else
        echo "Polyfills already enabled in $TERMUX_CONNECTION"
    fi
else
    echo "Warning: $TERMUX_CONNECTION not found. You'll need to manually add require('./use-polyfills') to your main file."
fi

# Attempt to install main dependencies
echo "Installing primary dependencies..."
npm install --no-optional 2>> "$INSTALL_LOG" || {
    echo "Standard npm install failed. Trying with Termux-specific package.json..."
    cp package.json package.json.original
    cp package.json.termux package.json
    npm install --no-optional 2>> "$INSTALL_LOG"
    # Restore original package.json
    mv package.json.original package.json
}

# Attempt to install canvas with reduced functionality
echo "Attempting to install canvas (this might fail, but we have polyfills)..."
npm install canvas --no-optional --no-canvas 2>> "$INSTALL_LOG" || {
    echo "Canvas installation failed, but that's OK - our polyfill will be used."
}

# Attempt to install sharp with reduced functionality
echo "Attempting to install sharp (this might fail, but we have polyfills)..."
npm install sharp --ignore-scripts --no-optional 2>> "$INSTALL_LOG" || {
    echo "Sharp installation failed, but that's OK - our polyfill will be used."
}

# Create a minimal package for Jimp as it's more compatible with Termux
echo "Installing Jimp as a more compatible image processing alternative..."
npm install jimp 2>> "$INSTALL_LOG" || echo "Jimp installation failed. Will use fallbacks."

echo "==============================================="
echo "Dependency installation process complete!"
echo "==============================================="
echo "We've set up:"
echo " - Core system dependencies for Termux"
echo " - Node.js modules that work well on Android"
echo " - Fallback polyfills for Canvas and Sharp"
echo " - Module loader patching for graceful degradation"
echo ""
echo "Notes:"
echo " - Some image features may use simplified graphics"
echo " - Stickers will still work but may be lower quality"
echo " - Level cards will use simple text instead of graphics"
echo ""
echo "Next steps:"
echo " 1. Run the bot with: node src/termux-connection.js"
echo " 2. Or start in background: ./termux-start.sh"
echo "==============================================="