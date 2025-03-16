/**
 * Enhanced Reaction GIF Fixer
 * 
 * This script provides a more reliable fix for reaction GIFs by:
 * 1. Using direct access to source GIFs in attached_assets
 * 2. Copying files with proper error handling and verification
 * 3. Providing detailed logs about each GIF's status
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
const SOURCE_DIR = path.join(process.cwd(), 'attached_assets');
const TARGET_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const MANIFEST_PATH = path.join(process.cwd(), 'reaction_gifs_manifest.json');

// Map of reaction commands to appropriate source GIFs
// These mappings ensure semantic matches between commands and GIF content
const REACTION_GIF_MAPPING = {
    // Self-reactions
    'smile': 'heavenly-joy-jerkins-i-am-so-excited.gif', // Happy smiling animation
    'happy': 'heavenly-joy-jerkins-i-am-so-excited.gif', // Happy excitement
    'dance': 'B6ya.gif', // Dance animation
    'cry': 'long-tears.gif', // Crying animation
    'blush': '0fd379b81bc8023064986c9c45f22253_w200.gif', // Blushing animation
    'laugh': 'laugh.gif', // Updated laugh animation with person laughing
    
    // Target-reactions
    'hug': 'tumblr_cdeb20431732069e4456c4ab66b9534f_8178dd55_500.gif', // Hugging animation
    'pat': 'pat.gif', // Updated patting animation with Stitch
    'kiss': 'tumblr_435925615ecd34c607dd730ab836eacf_4e338a28_540.gif', // Kissing animation
    'cuddle': 'icegif-890.gif', // Cuddling animation
    'wave': 'wave.gif', // Updated waving animation with character waving
    'wink': 'wink.gif', // Updated winking animation with person winking
    'poke': 'poke.gif', // Updated poking animation with chickens
    'slap': 'slap.gif', // Slapping animation
    'bonk': 'icegif-255.gif', // Bonking animation
    'bite': '15d3d956bd674096c4e68f1d011e8023.gif', // Biting-like animation
    'punch': '2Lmc.gif', // Punching animation
    'highfive': 'BT_L5v.gif', // High fiving (waving) animation
    'yeet': '15d3d956bd674096c4e68f1d011e8023.gif', // Throwing (bite-like) animation
    'kill': 'giphy.gif' // Intense animation for "kill" command
};

/**
 * Format file size in a human-readable way
 * @param {number} bytes File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Calculate a checksum for a file
 * @param {string} filePath Path to the file
 * @returns {string} MD5 checksum or null if error
 */
function calculateFileChecksum(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(fileBuffer).digest('hex');
    } catch (err) {
        console.error(`Error calculating checksum for ${filePath}: ${err.message}`);
        return null;
    }
}

/**
 * Directly copy a file with verification
 * @param {string} sourcePath Source file path
 * @param {string} targetPath Target file path
 * @returns {Object} Result object with success and details
 */
function directCopyFile(sourcePath, targetPath) {
    try {
        // Check if source exists
        if (!fs.existsSync(sourcePath)) {
            return {
                success: false,
                error: `Source file not found: ${sourcePath}`
            };
        }
        
        // Get source file stats
        const sourceStats = fs.statSync(sourcePath);
        
        // Copy the file
        fs.copyFileSync(sourcePath, targetPath);
        
        // Verify the copied file
        if (fs.existsSync(targetPath)) {
            const targetStats = fs.statSync(targetPath);
            const sourceChecksum = calculateFileChecksum(sourcePath);
            const targetChecksum = calculateFileChecksum(targetPath);
            
            return {
                success: true,
                sourceSize: sourceStats.size,
                targetSize: targetStats.size,
                sourceChecksum,
                targetChecksum,
                checksumMatch: sourceChecksum === targetChecksum,
                formattedSize: formatFileSize(targetStats.size)
            };
        } else {
            return {
                success: false,
                error: `Failed to verify copied file: ${targetPath} does not exist`
            };
        }
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Fix reaction GIFs by copying from source to target
 */
async function fixReactionGifs() {
    console.log('Starting Enhanced Reaction GIF Fixer...');
    
    // Create target directory if it doesn't exist
    if (!fs.existsSync(TARGET_DIR)) {
        try {
            fs.mkdirSync(TARGET_DIR, { recursive: true });
            console.log(`Created target directory: ${TARGET_DIR}`);
        } catch (err) {
            console.error(`Failed to create target directory: ${err.message}`);
            return;
        }
    }
    
    const results = {
        successful: [],
        failed: [],
        missing: [],
        skipped: []
    };
    
    // Process each reaction type
    Object.entries(REACTION_GIF_MAPPING).forEach(([reactionType, sourceFileName]) => {
        // Determine file paths
        const sourcePath = path.join(SOURCE_DIR, sourceFileName);
        const targetPath = path.join(TARGET_DIR, `${reactionType}.gif`);
        
        console.log(`\nProcessing: ${reactionType} -> ${sourceFileName}`);
        
        // Check if source file exists
        if (!fs.existsSync(sourcePath)) {
            console.error(`  ❌ Source file not found: ${sourcePath}`);
            results.missing.push({
                type: reactionType,
                sourceFile: sourceFileName,
                reason: 'Source file not found'
            });
            return;
        }
        
        // Check if target needs updating
        let needsUpdate = true;
        
        if (fs.existsSync(targetPath)) {
            try {
                const sourceStats = fs.statSync(sourcePath);
                const targetStats = fs.statSync(targetPath);
                const sourceChecksum = calculateFileChecksum(sourcePath);
                const targetChecksum = calculateFileChecksum(targetPath);
                
                // If checksums match, no need to update
                if (targetStats.size > 1024 && sourceChecksum === targetChecksum) {
                    console.log(`  ✓ GIF already up to date: ${reactionType}.gif (${formatFileSize(targetStats.size)})`);
                    results.skipped.push({
                        type: reactionType,
                        sourceFile: sourceFileName,
                        targetFile: `${reactionType}.gif`,
                        size: targetStats.size,
                        formattedSize: formatFileSize(targetStats.size),
                        checksum: targetChecksum
                    });
                    needsUpdate = false;
                }
            } catch (err) {
                console.warn(`  ⚠️ Error checking file stats, will force update: ${err.message}`);
            }
        }
        
        if (needsUpdate) {
            console.log(`  Updating ${reactionType}.gif from ${sourceFileName}...`);
            
            const copyResult = directCopyFile(sourcePath, targetPath);
            
            if (copyResult.success) {
                console.log(`  ✅ Successfully updated ${reactionType}.gif (${copyResult.formattedSize})`);
                if (!copyResult.checksumMatch) {
                    console.warn(`  ⚠️ Warning: Checksum mismatch after copy!`);
                }
                
                results.successful.push({
                    type: reactionType,
                    sourceFile: sourceFileName,
                    targetFile: `${reactionType}.gif`,
                    size: copyResult.targetSize,
                    formattedSize: copyResult.formattedSize,
                    checksumMatch: copyResult.checksumMatch,
                    checksum: copyResult.targetChecksum
                });
            } else {
                console.error(`  ❌ Failed to update ${reactionType}.gif: ${copyResult.error}`);
                
                results.failed.push({
                    type: reactionType,
                    sourceFile: sourceFileName,
                    reason: copyResult.error
                });
            }
        }
    });
    
    // Create a manifest file with results
    try {
        const manifest = {
            timestamp: new Date().toISOString(),
            results
        };
        
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        console.log(`\nManifest file created: ${MANIFEST_PATH}`);
    } catch (err) {
        console.error(`Failed to create manifest file: ${err.message}`);
    }
    
    // Print summary
    console.log('\n=== Reaction GIF Fix Summary ===');
    console.log(`Total reactions: ${Object.keys(REACTION_GIF_MAPPING).length}`);
    console.log(`Successful: ${results.successful.length}`);
    console.log(`Skipped (already up to date): ${results.skipped.length}`);
    console.log(`Failed: ${results.failed.length}`);
    console.log(`Missing sources: ${results.missing.length}`);
    console.log('===============================');
}

// Run the fix function if this script is executed directly
if (require.main === module) {
    fixReactionGifs().catch(err => {
        console.error('Error in reaction GIF fixer:', err);
    });
}

module.exports = { fixReactionGifs };