const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('./logger');

/**
 * Converts a GIF to MP4 format suitable for WhatsApp playback
 * @param {Buffer} gifBuffer The GIF file buffer
 * @returns {Promise<Buffer>} The converted MP4 buffer
 */
async function convertGifToMp4(gifBuffer) {
    return new Promise((resolve, reject) => {
        // Create temporary files for processing with unique timestamps
        const timestamp = Date.now();
        const tempGifPath = path.join(os.tmpdir(), `temp_${timestamp}.gif`);
        const tempMp4Path = path.join(os.tmpdir(), `temp_${timestamp}.mp4`);

        try {
            // Write the GIF buffer to a temporary file
            fs.writeFileSync(tempGifPath, gifBuffer);
            logger.info(`Temporary GIF saved to: ${tempGifPath}`);

            // Configure ffmpeg with simpler settings
            ffmpeg(tempGifPath)
                .outputOptions([
                    '-y', // Always overwrite output files
                    '-movflags faststart',
                    '-pix_fmt yuv420p', 
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2' // Fixed: removed quotes
                ])
                .toFormat('mp4')
                .on('start', (commandLine) => {
                    logger.info(`Starting ffmpeg conversion: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress && progress.percent) {
                        logger.info(`Processing: ${progress.percent}% done`);
                    }
                })
                .on('end', () => {
                    logger.info('Conversion completed successfully');
                    try {
                        // Read the converted file
                        const mp4Buffer = fs.readFileSync(tempMp4Path);

                        // Cleanup temporary files
                        fs.unlinkSync(tempGifPath);
                        fs.unlinkSync(tempMp4Path);

                        resolve(mp4Buffer);
                    } catch (readError) {
                        logger.error(`Error reading converted file: ${readError.message}`);
                        reject(readError);
                    }
                })
                .on('error', (err) => {
                    logger.error(`Error in ffmpeg conversion: ${err.message}`);
                    logger.error(`ffmpeg stderr: ${err.stderr || 'No stderr output'}`);

                    // Cleanup temporary files
                    if (fs.existsSync(tempGifPath)) fs.unlinkSync(tempGifPath);
                    if (fs.existsSync(tempMp4Path)) fs.unlinkSync(tempMp4Path);

                    reject(err);
                })
                .save(tempMp4Path);

        } catch (err) {
            logger.error(`Error in convertGifToMp4: ${err.message}`);

            // Cleanup temporary files
            if (fs.existsSync(tempGifPath)) fs.unlinkSync(tempGifPath);
            if (fs.existsSync(tempMp4Path)) fs.unlinkSync(tempMp4Path);

            reject(err);
        }
    });
}

module.exports = { convertGifToMp4 };