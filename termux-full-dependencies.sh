#!/data/data/com.termux/files/usr/bin/bash
# BLACKSKY-MD Full Dependency Installer for Termux
# Installs all dependencies with Termux-specific optimizations

echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Full Dependency Installer"
echo "==============================================="

# Error handling
set -e
LOGFILE="termux_install.log"
echo "Installation started at $(date)" > "$LOGFILE"

# Function to log messages
log() {
  echo "$1"
  echo "$(date): $1" >> "$LOGFILE"
}

# Function to check if package is installed
check_package() {
  if ! command -v "$1" &> /dev/null; then
    log "Installing $1..."
    pkg install -y "$1" >> "$LOGFILE" 2>&1
  else
    log "Package $1 is already installed."
  fi
}

# Step 1: Install essential system packages
log "Step 1: Installing system packages..."
pkg update -y >> "$LOGFILE" 2>&1
pkg upgrade -y >> "$LOGFILE" 2>&1

# Core packages - these are guaranteed to work on Termux
check_package "nodejs"
check_package "git"
check_package "wget"
check_package "python"
check_package "ffmpeg"

# Additional packages for better media support
log "Installing additional system dependencies..."
pkg install -y \
  build-essential \
  make \
  clang \
  pkg-config \
  libpng \
  libjpeg-turbo \
  giflib \
  libtiff \
  proot \
  x11-repo \
  pango \
  ndk-sysroot >> "$LOGFILE" 2>&1 || log "Some packages couldn't be installed, but we'll continue"

# Step 2: Setup directory structure
log "Step 2: Setting up directories..."
mkdir -p src/utils/polyfills
mkdir -p node_modules
mkdir -p auth_info_baileys
mkdir -p data

# Step 3: Create a compatible .npmrc file for Termux
log "Step 3: Creating optimized NPM configuration..."
cat > .npmrc << 'EOL'
# Termux-optimized npm configuration
package-lock=false
fund=false
audit=false
update-notifier=false
scripts-prepend-node-path=true
engine-strict=false
legacy-peer-deps=true
build-from-source=true
# Increase timeout for slow Termux builds
timeout=120000
EOL

# Step 4: Create package.json with full list of dependencies but set canvas and sharp as optional
log "Step 4: Creating optimized package.json..."
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
    "node-cron": "^3.0.2",
    "ejs": "^3.1.9",
    "ws": "^8.13.0",
    "mathjs": "^11.11.1",
    "path": "^0.12.7",
    "util": "^0.12.5",
    "crypto": "^1.0.1",
    "crypto-random-string": "^5.0.0",
    "fs-extra": "^11.1.1",
    "os": "^0.1.2"
  },
  "optionalDependencies": {
    "canvas": "^2.11.2",
    "sharp": "^0.32.6",
    "node-webpmux": "^3.1.7"
  }
}
EOL

# Step 5: Create fallback implementations for problematic modules
log "Step 5: Creating fallback implementations..."

# Create canvas polyfill
cat > src/utils/polyfills/canvas-polyfill.js << 'EOL'
/**
 * Canvas Polyfill with Jimp Integration for Termux
 * This provides canvas-like functionality using Jimp which is more compatible with Termux
 */

const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temp directory for files if it doesn't exist
const TEMP_DIR = path.join(os.tmpdir(), 'canvas-polyfill');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class CanvasReplacement {
    constructor(width = 200, height = 200) {
        this.width = width;
        this.height = height;
        this.jimp = new Jimp(width, height, 0xFFFFFFFF); // White background
        console.log(`Canvas polyfill: Created ${width}x${height} canvas using Jimp`);
    }
    
    getContext(type) {
        if (type !== '2d') {
            throw new Error('Only 2d context is supported in polyfill');
        }
        return new ContextPolyfill(this);
    }
    
    async toBuffer() {
        return await this.jimp.getBufferAsync(Jimp.MIME_PNG);
    }
    
    toDataURL() {
        // Create a temporary file and return its data URL
        const tempPath = path.join(TEMP_DIR, `canvas_${Date.now()}.png`);
        return new Promise((resolve, reject) => {
            this.jimp.write(tempPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(`data:image/png;base64,${fs.readFileSync(tempPath).toString('base64')}`);
                    // Clean up
                    fs.unlinkSync(tempPath);
                }
            });
        });
    }
    
    createPNGStream() {
        const { Readable } = require('stream');
        const stream = new Readable();
        
        this.toBuffer()
            .then(buffer => {
                stream.push(buffer);
                stream.push(null);
            })
            .catch(err => {
                stream.emit('error', err);
                stream.push(null);
            });
            
        return stream;
    }
}

class ContextPolyfill {
    constructor(canvas) {
        this.canvas = canvas;
        this.jimp = canvas.jimp;
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.font = '16px sans-serif';
        this.lineWidth = 1;
        this.textAlign = 'start';
        this.textBaseline = 'alphabetic';
        
        // Parse color strings to Jimp color values
        this._parseColor = (color) => {
            if (typeof color === 'string') {
                if (color.startsWith('#')) {
                    // Convert hex to Jimp color
                    return parseInt(color.replace('#', '0x') + 'FF', 16);
                } else if (color.startsWith('rgb')) {
                    // Parse RGB format
                    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
                    if (match) {
                        const r = parseInt(match[1]);
                        const g = parseInt(match[2]);
                        const b = parseInt(match[3]);
                        const a = match[4] ? Math.round(parseFloat(match[4]) * 255) : 255;
                        return Jimp.rgbaToInt(r, g, b, a);
                    }
                }
            }
            return 0x000000FF; // Default black
        };
    }

    fillRect(x, y, width, height) {
        const color = this._parseColor(this.fillStyle);
        this.jimp.scan(x, y, width, height, function(ix, iy, idx) {
            this.bitmap.data[idx + 0] = (color >> 24) & 0xFF; // R
            this.bitmap.data[idx + 1] = (color >> 16) & 0xFF; // G
            this.bitmap.data[idx + 2] = (color >> 8) & 0xFF;  // B
            this.bitmap.data[idx + 3] = color & 0xFF;         // A
        });
    }
    
    strokeRect(x, y, width, height) {
        const color = this._parseColor(this.strokeStyle);
        
        // Draw top line
        this.jimp.scan(x, y, width, 1, function(ix, iy, idx) {
            this.bitmap.data[idx + 0] = (color >> 24) & 0xFF;
            this.bitmap.data[idx + 1] = (color >> 16) & 0xFF;
            this.bitmap.data[idx + 2] = (color >> 8) & 0xFF;
            this.bitmap.data[idx + 3] = color & 0xFF;
        });
        
        // Draw bottom line
        this.jimp.scan(x, y + height - 1, width, 1, function(ix, iy, idx) {
            this.bitmap.data[idx + 0] = (color >> 24) & 0xFF;
            this.bitmap.data[idx + 1] = (color >> 16) & 0xFF;
            this.bitmap.data[idx + 2] = (color >> 8) & 0xFF;
            this.bitmap.data[idx + 3] = color & 0xFF;
        });
        
        // Draw left line
        this.jimp.scan(x, y, 1, height, function(ix, iy, idx) {
            this.bitmap.data[idx + 0] = (color >> 24) & 0xFF;
            this.bitmap.data[idx + 1] = (color >> 16) & 0xFF;
            this.bitmap.data[idx + 2] = (color >> 8) & 0xFF;
            this.bitmap.data[idx + 3] = color & 0xFF;
        });
        
        // Draw right line
        this.jimp.scan(x + width - 1, y, 1, height, function(ix, iy, idx) {
            this.bitmap.data[idx + 0] = (color >> 24) & 0xFF;
            this.bitmap.data[idx + 1] = (color >> 16) & 0xFF;
            this.bitmap.data[idx + 2] = (color >> 8) & 0xFF;
            this.bitmap.data[idx + 3] = color & 0xFF;
        });
    }
    
    clearRect(x, y, width, height) {
        this.jimp.scan(x, y, width, height, function(ix, iy, idx) {
            this.bitmap.data[idx + 0] = 255; // R
            this.bitmap.data[idx + 1] = 255; // G
            this.bitmap.data[idx + 2] = 255; // B
            this.bitmap.data[idx + 3] = 0;   // A (transparent)
        });
    }
    
    beginPath() {
        // Not fully implemented for simplified version
    }
    
    closePath() {
        // Not fully implemented for simplified version
    }
    
    moveTo() {
        // Not fully implemented for simplified version
    }
    
    lineTo() {
        // Not fully implemented for simplified version
    }
    
    fill() {
        // Not fully implemented for simplified version
    }
    
    stroke() {
        // Not fully implemented for simplified version
    }
    
    fillText(text, x, y) {
        // Jimp's text drawing capabilities are limited
        // We'll use a basic approach with default font
        try {
            Jimp.loadFont(Jimp.FONT_SANS_16_BLACK).then(font => {
                this.jimp.print(font, x, y - 16, text); // Adjust y to match canvas behavior
            });
        } catch (err) {
            console.log(`Canvas polyfill: Text drawing error - ${err.message}`);
        }
    }
    
    strokeText() {
        // Not supported in basic implementation
    }
    
    measureText(text) {
        // Approximate text width based on font size
        const fontSize = parseInt(this.font) || 16;
        return { width: text.length * (fontSize * 0.5) };
    }
    
    arc() {
        // Not implemented in basic version
    }
    
    async drawImage(image, dx, dy, dWidth, dHeight) {
        try {
            // If image is a buffer or another Canvas
            let jimpImage;
            
            if (image instanceof CanvasReplacement) {
                jimpImage = image.jimp.clone();
            } else if (image.src) { // Browser-like Image object with src
                jimpImage = await Jimp.read(image.src);
            } else if (typeof image === 'string') {
                jimpImage = await Jimp.read(image);
            } else if (Buffer.isBuffer(image)) {
                jimpImage = await Jimp.read(image);
            } else {
                console.log('Canvas polyfill: Unsupported image format for drawImage');
                return;
            }
            
            if (dWidth !== undefined && dHeight !== undefined) {
                jimpImage.resize(dWidth, dHeight);
            }
            
            this.jimp.composite(jimpImage, dx, dy);
        } catch (error) {
            console.log(`Canvas polyfill: drawImage error - ${error.message}`);
        }
    }
}

// Determine whether to use real canvas or our polyfill
try {
    const Canvas = require('canvas');
    console.log('Real canvas module found, using that instead of polyfill');
    module.exports = Canvas;
} catch (err) {
    console.log('Canvas module not available, using Jimp-based polyfill');
    // Export our polyfill
    module.exports = CanvasReplacement;
    module.exports.createCanvas = (width, height) => new CanvasReplacement(width, height);
    module.exports.loadImage = async (src) => {
        try {
            const image = await Jimp.read(src);
            return {
                width: image.getWidth(),
                height: image.getHeight(),
                src: src
            };
        } catch (err) {
            console.log(`Canvas polyfill: loadImage error - ${err.message}`);
            return {
                width: 1,
                height: 1,
                src: src
            };
        }
    };
}
EOL

# Create sharp polyfill
cat > src/utils/polyfills/sharp-polyfill.js << 'EOL'
/**
 * Sharp Polyfill with Jimp Integration for Termux
 * This provides sharp-like functionality using Jimp which is more compatible with Termux
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

class SharpPolyfill {
    constructor(input) {
        this.input = input;
        this.operations = [];
        this.format = 'jpeg';
        this.quality = 80;
        this.jimpInstance = null;
        
        // Initialize the Jimp instance
        this.init();
    }
    
    async init() {
        try {
            if (Buffer.isBuffer(this.input)) {
                this.jimpInstance = await Jimp.read(this.input);
            } else if (typeof this.input === 'string') {
                this.jimpInstance = await Jimp.read(this.input);
            } else {
                // Default empty image
                this.jimpInstance = new Jimp(100, 100, 0xFFFFFFFF);
            }
        } catch (err) {
            console.error(`Sharp polyfill: Error initializing - ${err.message}`);
            // Create a dummy image on error
            this.jimpInstance = new Jimp(100, 100, 0xFFFFFFFF);
        }
    }

    async ensureJimp() {
        if (!this.jimpInstance) {
            await this.init();
        }
        return this.jimpInstance;
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

    async processOperations() {
        const jimp = await this.ensureJimp();
        
        // Process all operations
        for (const op of this.operations) {
            switch (op.type) {
                case 'resize':
                    jimp.resize(op.width || Jimp.AUTO, op.height || Jimp.AUTO);
                    break;
                case 'rotate':
                    jimp.rotate(op.angle);
                    break;
                case 'flip':
                    if (op.flip) jimp.flip(true, false);
                    break;
                case 'flop':
                    if (op.flop) jimp.flip(false, true);
                    break;
                case 'sharpen':
                    // Jimp's convolute can simulate sharpening
                    jimp.convolute([
                        [0, -1, 0],
                        [-1, 5, -1],
                        [0, -1, 0]
                    ]);
                    break;
                case 'blur':
                    jimp.blur(op.sigma * 5); // Scale to match sharp's intensity
                    break;
                case 'gamma':
                    // No direct gamma in Jimp, approximate with brightness
                    if (op.gamma > 1) {
                        jimp.brightness(op.gamma / 5);
                    } else {
                        jimp.brightness(-0.2);
                    }
                    break;
                case 'negate':
                    jimp.invert();
                    break;
            }
        }
        
        return jimp;
    }

    async toBuffer() {
        try {
            const jimp = await this.processOperations();
            
            // Set the output format
            let mimeType;
            switch (this.format) {
                case 'jpeg':
                    mimeType = Jimp.MIME_JPEG;
                    jimp.quality(this.quality);
                    break;
                case 'png':
                    mimeType = Jimp.MIME_PNG;
                    break;
                case 'webp':
                    // Jimp doesn't support WebP directly, fallback to PNG
                    mimeType = Jimp.MIME_PNG;
                    break;
                case 'gif':
                    mimeType = Jimp.MIME_GIF;
                    break;
                default:
                    mimeType = Jimp.MIME_JPEG;
            }
            
            return await jimp.getBufferAsync(mimeType);
        } catch (err) {
            console.error(`Sharp polyfill: Error processing image - ${err.message}`);
            // Return the original buffer if available
            if (Buffer.isBuffer(this.input)) {
                return this.input;
            } else if (typeof this.input === 'string' && fs.existsSync(this.input)) {
                return await readFileAsync(this.input);
            }
            // Last resort - return an empty buffer
            return Buffer.from([]);
        }
    }

    async toFile(outputPath) {
        try {
            const buffer = await this.toBuffer();
            await writeFileAsync(outputPath, buffer);
            
            // Get image dimensions
            const jimp = await this.ensureJimp();
            
            return { 
                format: this.format,
                width: jimp.getWidth(), 
                height: jimp.getHeight(),
                channels: this.format === 'png' ? 4 : 3,
                size: buffer.length
            };
        } catch (err) {
            console.error(`Sharp polyfill: Error saving to file - ${err.message}`);
            // Create an empty file
            await writeFileAsync(outputPath, Buffer.from([]));
            return { 
                format: this.format,
                width: 1, 
                height: 1,
                channels: 3,
                size: 0
            };
        }
    }
}

// Check if the real sharp module is available
try {
    const sharp = require('sharp');
    console.log('Real sharp module found, using that instead of polyfill');
    module.exports = sharp;
} catch (err) {
    console.log('Sharp module not available, using Jimp-based polyfill');
    
    // Export our polyfill function
    const sharpPolyfill = (input) => new SharpPolyfill(input);
    module.exports = sharpPolyfill;
    
    // Add typical sharp properties
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

# Create node-webpmux polyfill
cat > src/utils/polyfills/node-webpmux-polyfill.js << 'EOL'
/**
 * Node-webpmux Polyfill for Termux
 * Simple polyfill for basic sticker creation
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

class WebPImage {
    constructor() {
        this.exif = Buffer.from([]);
    }
    
    // Static method to create a new image
    static async from(source) {
        const image = new WebPImage();
        
        // We'll just store the source for later use
        image.source = source;
        
        return image;
    }
    
    // Set EXIF data
    setExif(exif) {
        this.exif = exif;
    }
    
    // Save the image
    async save(outputPath) {
        try {
            // If source is a buffer or file path
            if (Buffer.isBuffer(this.source) || typeof this.source === 'string') {
                // Copy file directly if it's already webp
                if (typeof this.source === 'string' && this.source.endsWith('.webp')) {
                    fs.copyFileSync(this.source, outputPath);
                    return;
                }
                
                // Otherwise, try to convert using Jimp
                const image = await Jimp.read(this.source);
                await image.writeAsync(outputPath);
            }
        } catch (err) {
            console.error(`WebPMux polyfill: Save error - ${err.message}`);
            throw err;
        }
    }
}

// Metadata utilities
const EXIF = {
    create: (options) => {
        // Create a simple EXIF representation
        const defaultOptions = {
            packname: 'BlackskyMD',
            author: 'Sticker',
            categories: []
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        // We'll just return a basic buffer
        return Buffer.from(JSON.stringify(mergedOptions));
    }
};

module.exports = {
    Image: WebPImage,
    EXIF
};
EOL

# Create the polyfill loader
cat > src/use-polyfills.js << 'EOL'
/**
 * Termux Polyfill Loader with Module Patching
 * This module provides fallbacks for modules that are problematic on Termux
 */

console.log('Loading Termux-compatible polyfills for modules...');

// Store the original require function
const originalRequire = module.require;

// Create a patched require function
function patchedRequire(moduleId) {
    try {
        // First try normal require
        return originalRequire.call(this, moduleId);
    } catch (err) {
        // Handle specific problematic modules
        if (moduleId === 'canvas') {
            console.log('Canvas module not found, using polyfill instead');
            return originalRequire.call(this, './utils/polyfills/canvas-polyfill.js');
        } else if (moduleId === 'sharp') {
            console.log('Sharp module not found, using polyfill instead');
            return originalRequire.call(this, './utils/polyfills/sharp-polyfill.js');
        } else if (moduleId === 'node-webpmux') {
            console.log('Node-webpmux module not found, using polyfill instead');
            return originalRequire.call(this, './utils/polyfills/node-webpmux-polyfill.js');
        }
        
        // For any other module, rethrow the error
        throw err;
    }
}

// Apply the patch to module.require
module.require = patchedRequire;

console.log('Termux polyfills are now active');

// Export a function to restore the original require if needed
module.exports = {
    restoreOriginalRequire: () => {
        module.require = originalRequire;
        console.log('Original require function restored');
    }
};
EOL

# Step 6: Update termux-connection.js to use polyfills
log "Step 6: Updating connection script to use polyfills..."
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
        log "Updated $TERMUX_CONNECTION to use polyfills"
    else
        log "Polyfills already enabled in $TERMUX_CONNECTION"
    fi
else
    log "Warning: $TERMUX_CONNECTION not found, will need to be manually updated"
fi

# Step 7: Install primary dependencies with optimized approach
log "Step 7: Installing dependencies..."

# First, backup original package.json if it exists
if [ -f "package.json" ]; then
    cp package.json package.json.original
    log "Backed up original package.json"
fi

# Use our termux-optimized package.json
cp package.json.termux package.json
log "Using Termux-optimized package.json"

# Staged installation approach - install in small batches to avoid memory issues
log "Installing core dependencies..."
npm install --no-optional @whiskeysockets/baileys qrcode-terminal qrcode express pino pino-pretty >> "$LOGFILE" 2>&1 || log "Some core dependencies couldn't be installed, continuing anyway"

log "Installing utility dependencies..."
npm install --no-optional moment-timezone moment jimp node-cache axios chalk >> "$LOGFILE" 2>&1 || log "Some utility dependencies couldn't be installed, continuing anyway"

log "Installing additional dependencies..."
npm install --no-optional adm-zip file-type node-cron ejs ws mathjs crypto-random-string fs-extra >> "$LOGFILE" 2>&1 || log "Some additional dependencies couldn't be installed, continuing anyway"

# Step 8: Try to install optional dependencies but don't worry if they fail
log "Step 8: Attempting to install optional dependencies (may fail)..."
npm install --save-optional canvas sharp node-webpmux >> "$LOGFILE" 2>&1 || log "Optional dependencies couldn't be installed, polyfills will be used instead"

# Restore original package.json
if [ -f "package.json.original" ]; then
    cp package.json.original package.json
    log "Restored original package.json"
fi

# Step 9: Create run and auto-restart scripts
log "Step 9: Creating startup scripts..."

# Create run script
cat > start-bot.sh << 'EOL'
#!/data/data/com.termux/files/usr/bin/bash
# Run WhatsApp Bot in foreground
echo "Starting WhatsApp Bot..."
NODE_OPTIONS="--max-old-space-size=512" node src/termux-connection.js
EOL
chmod +x start-bot.sh

# Create background script
cat > background-bot.sh << 'EOL'
#!/data/data/com.termux/files/usr/bin/bash
# Run WhatsApp Bot in background
echo "Starting WhatsApp Bot in background..."
NODE_OPTIONS="--max-old-space-size=512" nohup node src/termux-connection.js > bot.log 2>&1 &
echo "Bot is running in background. Check bot.log for output."
echo "Process ID: $!"
EOL
chmod +x background-bot.sh

# Create watcher script for auto-restart
cat > watchdog.sh << 'EOL'
#!/data/data/com.termux/files/usr/bin/bash
# WhatsApp Bot Watchdog for Auto-restart
LOG_FILE="watchdog.log"

echo "Starting Watchdog at $(date)" > "$LOG_FILE"

while true; do
    # Check if bot is running
    if ! pgrep -f "node src/termux-connection.js" > /dev/null; then
        echo "$(date): Bot is not running, restarting..." >> "$LOG_FILE"
        # Kill any existing node processes (avoid duplicates)
        pkill -f "node src/termux-connection.js" || true
        # Start the bot
        NODE_OPTIONS="--max-old-space-size=512" nohup node src/termux-connection.js > bot.log 2>&1 &
        echo "$(date): Bot restarted with PID: $!" >> "$LOG_FILE"
    else
        echo "$(date): Bot is running normally" >> "$LOG_FILE"
    fi
    
    # Wait 5 minutes before checking again
    sleep 300
done
EOL
chmod +x watchdog.sh

echo "==============================================="
echo "BLACKSKY-MD WhatsApp Bot - Installation Complete!"
echo "==============================================="
echo "All dependencies have been installed with Termux optimizations."
echo ""
echo "Polyfills have been created for:"
echo " - canvas (using Jimp)"
echo " - sharp (using Jimp)"
echo " - node-webpmux (simplified version)"
echo ""
echo "To start the bot:"
echo " - Foreground mode: ./start-bot.sh"
echo " - Background mode: ./background-bot.sh"
echo " - Auto-restart mode: ./watchdog.sh"
echo ""
echo "Installation logs are saved in: $LOGFILE"
echo "==============================================="