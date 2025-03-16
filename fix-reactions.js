/**
 * Fix for reaction commands
 * This script will set up the required directories and validate GIF files
 */

const fs = require('fs');
const path = require('path');
const logger = console;

// Constants
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const MIN_VALID_GIF_SIZE = 1024; // 1KB

// Ensure the reactions directory exists
function ensureDirectoriesExist() {
    if (!fs.existsSync(REACTIONS_DIR)) {
        logger.log(`Creating directory: ${REACTIONS_DIR}`);
        fs.mkdirSync(REACTIONS_DIR, { recursive: true });
    } else {
        logger.log(`Directory exists: ${REACTIONS_DIR}`);
    }
}

// Map of reaction types
const REACTION_TYPES = [
    'hug', 'pat', 'kiss', 'cuddle',
    'smile', 'happy', 'wave', 'dance', 'cry', 'blush', 'laugh', 'wink',
    'poke', 'slap', 'bonk', 'bite', 'punch', 'highfive', 'yeet', 'kill'
];

// Check all reaction GIFs and report status
function validateReactionGifs() {
    logger.log('\nValidating reaction GIFs:');
    
    const validGifs = [];
    const missingGifs = [];
    
    for (const type of REACTION_TYPES) {
        const gifPath = path.join(REACTIONS_DIR, `${type}.gif`);
        
        let found = false;
        let size = 0;
        let location = '';
        
        // Check if the GIF exists in the reactions directory
        if (fs.existsSync(gifPath)) {
            const stats = fs.statSync(gifPath);
            size = stats.size;
            location = gifPath;
            found = size >= MIN_VALID_GIF_SIZE;
        }
        
        if (found) {
            validGifs.push({ type, location, size });
            logger.log(`✅ [${type}] Valid GIF found (${formatSize(size)}): ${location}`);
        } else {
            missingGifs.push({ type, location: location || 'Not found', size });
            logger.log(`❌ [${type}] Valid GIF missing or too small: ${location || 'Not found'} (${formatSize(size)})`);
        }
    }
    
    return { validGifs, missingGifs };
}

// Format file size in human readable format
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

// Create a placeholder GIF for missing files
// This is better than having empty files
function createPlaceholderForMissing(missingGifs) {
    logger.log('\nCreating placeholders for missing GIFs:');
    
    // We need a valid GIF to use as a placeholder
    const validGifs = fs.readdirSync(REACTIONS_DIR)
        .filter(f => f.endsWith('.gif') && fs.statSync(path.join(REACTIONS_DIR, f)).size >= MIN_VALID_GIF_SIZE);
        
    if (validGifs.length === 0) {
        logger.log('❌ No valid GIFs found to use as placeholder');
        return false;
    }
    
    // Use the first valid GIF as a placeholder
    const placeholderPath = path.join(REACTIONS_DIR, validGifs[0]);
    const placeholderBuffer = fs.readFileSync(placeholderPath);
    
    logger.log(`Using ${placeholderPath} (${formatSize(placeholderBuffer.length)}) as placeholder`);
    
    for (const missing of missingGifs) {
        const targetPath = path.join(REACTIONS_DIR, `${missing.type}.gif`);
        
        // Don't overwrite if it already exists at the main location
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).size >= MIN_VALID_GIF_SIZE) {
            logger.log(`⏭️ [${missing.type}] Already exists, skipping`);
            continue;
        }
        
        try {
            fs.writeFileSync(targetPath, placeholderBuffer);
            logger.log(`✅ [${missing.type}] Created placeholder GIF`);
        } catch (err) {
            logger.log(`❌ [${missing.type}] Failed to create placeholder: ${err.message}`);
        }
    }
    
    return true;
}

// Main function
function main() {
    logger.log('Starting reaction commands fix...');
    
    ensureDirectoriesExist();
    
    const { validGifs, missingGifs } = validateReactionGifs();
    
    logger.log(`\nValid GIFs: ${validGifs.length} / ${REACTION_TYPES.length}`);
    logger.log(`Missing GIFs: ${missingGifs.length} / ${REACTION_TYPES.length}`);
    
    if (missingGifs.length > 0) {
        createPlaceholderForMissing(missingGifs);
    }
    
    logger.log('\nReaction commands fix completed!');
}

// Run the main function
main();