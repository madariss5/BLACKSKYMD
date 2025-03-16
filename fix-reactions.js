/**
 * Fix for reaction commands
 * This script will set up the required directories and validate GIF files
 */

const fs = require('fs');
const path = require('path');
const logger = console;

// Constants
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const ANIMATED_GIFS_DIR = path.join(process.cwd(), 'animated_gifs');
const MIN_VALID_GIF_SIZE = 1024; // 1KB

// Ensure directories exist
function ensureDirectoriesExist() {
    const dirs = [REACTIONS_DIR, ANIMATED_GIFS_DIR];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            logger.log(`Creating directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        } else {
            logger.log(`Directory exists: ${dir}`);
        }
    }
}

// Map of reaction types
const REACTION_TYPES = [
    'hug', 'pat', 'kiss', 'cuddle',
    'smile', 'happy', 'wave', 'dance', 'cry', 'blush', 'laugh', 'wink',
    'poke', 'slap', 'bonk', 'bite', 'punch', 'highfive', 'yeet'
];

// Check all reaction GIFs and report status
function validateReactionGifs() {
    logger.log('\nValidating reaction GIFs:');
    
    const validGifs = [];
    const missingGifs = [];
    
    for (const type of REACTION_TYPES) {
        const primaryPath = path.join(REACTIONS_DIR, `${type}.gif`);
        const fallbackPath = path.join(ANIMATED_GIFS_DIR, `${type}.gif`);
        
        let found = false;
        let size = 0;
        let location = '';
        
        // Check primary path
        if (fs.existsSync(primaryPath)) {
            const stats = fs.statSync(primaryPath);
            size = stats.size;
            location = primaryPath;
            found = size >= MIN_VALID_GIF_SIZE;
        }
        
        // If not valid in primary, check fallback
        if (!found && fs.existsSync(fallbackPath)) {
            const stats = fs.statSync(fallbackPath);
            size = stats.size;
            location = fallbackPath;
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