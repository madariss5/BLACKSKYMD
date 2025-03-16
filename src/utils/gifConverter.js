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
        // Create temporary files for processing
        const tempGifPath = path.join(os.tmpdir(), `temp_${Date.now()}.gif`);
        const tempMp4Path = path.join(os.tmpdir(), `temp_${Date.now()}.mp4`);

        // Write the GIF buffer to a temporary file
        fs.writeFileSync(tempGifPath, gifBuffer);

        ffmpeg(tempGifPath)
            .toFormat('mp4')
            .addOptions([
                '-movflags faststart',
                '-pix_fmt yuv420p',
                '-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"',
                '-preset ultrafast',
                '-y'
            ])
            .save(tempMp4Path)
            .on('end', () => {
                // Read the converted file
                const mp4Buffer = fs.readFileSync(tempMp4Path);
                
                // Cleanup temporary files
                fs.unlinkSync(tempGifPath);
                fs.unlinkSync(tempMp4Path);
                
                resolve(mp4Buffer);
            })
            .on('error', (err) => {
                logger.error(`Error converting GIF to MP4: ${err.message}`);
                
                // Cleanup temporary files
                if (fs.existsSync(tempGifPath)) fs.unlinkSync(tempGifPath);
                if (fs.existsSync(tempMp4Path)) fs.unlinkSync(tempMp4Path);
                
                reject(err);
            });
    });
}

module.exports = { convertGifToMp4 };
