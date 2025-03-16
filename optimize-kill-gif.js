/**
 * Optimize Kill GIF Script
 * This script optimizes the kill.gif file for WhatsApp compatibility
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inputPath = path.join(process.cwd(), 'data', 'reaction_gifs', 'kill.gif');
const outputPath = path.join(process.cwd(), 'data', 'reaction_gifs', 'kill_optimized.gif');
const backupPath = path.join(process.cwd(), 'data', 'reaction_gifs', 'kill.gif.original');

// Check if the file exists
if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

// Create a backup of the original
if (!fs.existsSync(backupPath)) {
    console.log(`Creating backup at: ${backupPath}`);
    fs.copyFileSync(inputPath, backupPath);
}

// Get file size
const stats = fs.statSync(inputPath);
console.log(`Original file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Configure optimization settings
async function optimizeGif() {
    try {
        console.log('Optimizing GIF...');
        
        // Read the original GIF
        const inputBuffer = fs.readFileSync(inputPath);
        
        // Resize and optimize with sharp
        const optimizedBuffer = await sharp(inputBuffer, { animated: true })
            .resize({ 
                width: 320, // Reduced dimensions
                height: 240,
                fit: 'inside',
                withoutEnlargement: true
            })
            .gif({ 
                quality: 60, // Lower quality for size reduction
                effort: 7,   // Higher value = better compression but slower
                loop: 0,     // Infinite loop
                dither: 0    // Lower dithering for size 
            })
            .toBuffer();
            
        // Save optimized GIF
        fs.writeFileSync(outputPath, optimizedBuffer);
        
        // Get optimized size
        const newStats = fs.statSync(outputPath);
        console.log(`Optimized file size: ${(newStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Size reduction: ${(100 - (newStats.size / stats.size * 100)).toFixed(2)}%`);
        
        // Replace original with optimized if successful
        if (newStats.size > 0 && newStats.size < stats.size) {
            fs.copyFileSync(outputPath, inputPath);
            console.log('Successfully replaced original with optimized version');
            fs.unlinkSync(outputPath); // Clean up temp file
        } else {
            console.warn('Optimization failed or did not reduce size significantly');
        }
    } catch (error) {
        console.error('Error optimizing GIF:', error);
    }
}

// Run the optimization
optimizeGif();