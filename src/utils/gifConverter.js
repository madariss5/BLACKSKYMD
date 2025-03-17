const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

// Cache for converted GIFs to avoid redundant conversions
const gifCache = new Map();
const CACHE_LIFETIME = 300000; // 5 minutes

/**
 * Converts a GIF to MP4 format suitable for WhatsApp playback
 * High-performance version with caching for ultra-fast reactions
 * @param {Buffer} gifBuffer The GIF file buffer
 * @returns {Promise<Buffer>} The converted MP4 buffer
 */
async function convertGifToMp4(gifBuffer) {
    // Generate a simple hash of the buffer for cache key
    const hash = require('crypto')
        .createHash('md5')
        .update(gifBuffer.slice(0, 1024)) // Only hash first 1KB for performance
        .digest('hex');
        
    // Check cache first for ultra-fast response
    const now = Date.now();
    if (gifCache.has(hash)) {
        const cachedItem = gifCache.get(hash);
        if (now - cachedItem.timestamp < CACHE_LIFETIME) {
            return cachedItem.buffer;
        }
    }
        
    return new Promise((resolve, reject) => {
        // Fast path: only create new temp files when actually needed
        const timestamp = Date.now();
        const tempGifPath = path.join(os.tmpdir(), `temp_${timestamp}.gif`);
        const tempMp4Path = path.join(os.tmpdir(), `temp_${timestamp}.mp4`);

        try {
            // Write the GIF buffer to a temporary file
            fs.writeFileSync(tempGifPath, gifBuffer);
            logger.info(`Temporary GIF saved to: ${tempGifPath}`);

            // Configure ffmpeg with optimized settings for maximum speed
            ffmpeg(tempGifPath)
                .outputOptions([
                    '-y', // Always overwrite output files
                    '-movflags faststart',
                    '-pix_fmt yuv420p',
                    '-vf', 'scale=320:-2', // Smaller size for faster processing
                    '-preset ultrafast', // Maximum speed conversion
                    '-tune animation', // Optimized for animated content
                    '-profile:v baseline', // More compatible
                    '-level 3.0', // Good compatibility
                    '-vsync vfr', // Variable framerate for better efficiency
                    '-threads 4' // Parallel processing
                ])
                .toFormat('mp4')
                .on('progress', (progress) => {
                    // Only log at 50% and 100% to reduce logger overhead
                    if (progress && progress.percent && (progress.percent > 80 || progress.percent === 100)) {
                        logger.info(`Processing: ${progress.percent}% done`);
                    }
                })
                .on('end', () => {
                    logger.info('Conversion completed successfully');
                    try {
                        // Read the converted file
                        const mp4Buffer = fs.readFileSync(tempMp4Path);

                        // Cache the result for future use
                        gifCache.set(hash, {
                            buffer: mp4Buffer,
                            timestamp: now
                        });
                        
                        // Cleanup temp files
                        try {
                            fs.unlinkSync(tempGifPath);
                            fs.unlinkSync(tempMp4Path);
                        } catch (cleanupError) {
                            // Ignore cleanup errors - don't impact performance
                        }

                        resolve(mp4Buffer);
                    } catch (readError) {
                        logger.error(`Error reading converted file: ${readError.message}`);
                        reject(readError);
                    }
                })
                .on('error', (err) => {
                    logger.error(`Error in ffmpeg conversion: ${err.message}`);

                    // Cleanup temporary files
                    try {
                        if (fs.existsSync(tempGifPath)) fs.unlinkSync(tempGifPath);
                        if (fs.existsSync(tempMp4Path)) fs.unlinkSync(tempMp4Path);
                    } catch (cleanupError) {
                        // Ignore cleanup errors
                    }

                    reject(err);
                })
                .save(tempMp4Path);

        } catch (err) {
            logger.error(`Error in convertGifToMp4: ${err.message}`);

            // Cleanup temporary files
            try {
                if (fs.existsSync(tempGifPath)) fs.unlinkSync(tempGifPath);
                if (fs.existsSync(tempMp4Path)) fs.unlinkSync(tempMp4Path);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            reject(err);
        }
    });
}

module.exports = { convertGifToMp4 };