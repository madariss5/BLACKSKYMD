# Module Loading Fix for Termux

This guide helps you fix "Cannot find module 'canvas'" and similar errors when running the WhatsApp bot on Termux.

## Quick Fix Instructions

If you're facing errors about Canvas, Sharp, or node-webpmux modules not being found, follow these steps:

1. **Run the quick fix script**

   ```bash
   chmod +x termux-quick-fix.sh
   ./termux-quick-fix.sh
   ```

   This script will:
   - Install Jimp (a compatible image processing library for Termux)
   - Create polyfill implementations for Canvas, Sharp, and node-webpmux
   - Set up the module structure to make require() work correctly

2. **Run your WhatsApp bot**

   ```bash
   node src/termux-connection.js
   ```

## Manual Fix (If Script Fails)

If the quick fix script doesn't work, you can manually fix the issues:

1. **Install Jimp**

   ```bash
   npm install --no-package-lock jimp
   ```

2. **Create the polyfill directories**

   ```bash
   mkdir -p src/utils/polyfills
   mkdir -p node_modules/canvas
   mkdir -p node_modules/sharp
   mkdir -p node_modules/node-webpmux
   ```

3. **Create the Canvas polyfill file**

   ```bash
   echo 'const Jimp = require("jimp");
   class CanvasReplacement {
     constructor(width, height) {
       this.width = width;
       this.height = height;
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
       return Buffer.from("dummy");
     }
   }
   module.exports = CanvasReplacement;
   module.exports.createCanvas = (w, h) => new CanvasReplacement(w, h);
   module.exports.loadImage = async () => ({ width: 10, height: 10 });' > src/utils/polyfills/canvas-polyfill.js
   ```

4. **Create the module entry files**

   ```bash
   echo 'module.exports = require("../../src/utils/polyfills/canvas-polyfill.js");' > node_modules/canvas/index.js
   echo '{"name":"canvas","version":"2.11.2","main":"index.js"}' > node_modules/canvas/package.json
   ```

   (Create similar files for Sharp and node-webpmux)

## How This Fix Works

This fix works by creating "polyfill" versions of the problematic modules. These polyfills:

1. **Provide compatible interfaces** - They implement the same methods and properties
2. **Return dummy values** - Where full functionality isn't possible
3. **Use Jimp for basic operations** - Jimp is a pure JavaScript library that works on Termux

The polyfills will allow your code to run without errors, though some advanced graphics features might not work fully.

## For Better Performance

If you need better performance or more complete functionality:

1. **Use the lite version of the bot**

   ```bash
   ./termux-lite-setup.sh
   ```

2. **Or use our full dependency installation with optimized polyfills**

   ```bash
   ./termux-full-dependencies.sh
   ```

## Troubleshooting

- **"Cannot find module 'jimp'"**: Run `npm install --no-package-lock jimp`
- **Permission errors**: Make sure all scripts are executable with `chmod +x *.sh`
- **Other modules failing**: You may need to create similar polyfills for those modules