const logger = require('../utils/logger');
const config = require('../config/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { writeExifToWebp } = require('../utils/stickerMetadata');
const axios = require('axios');
const FormData = require('form-data');
const audioQueue = new Map();
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const { getLyrics } = require('genius-lyrics-api');
const webp = require('node-webpmux');

const playNextInQueue = async (sock, sender) => {
    const queue = audioQueue.get(sender);
    if (queue && queue.length > 0) {
        const audioBuffer = queue.shift();
        try {
            await sock.sendMessage(sender, { audio: { url: audioBuffer } });
            if(queue.length > 0) {
                setTimeout(() => playNextInQueue(sock, sender), 1000);
            } else {
                audioQueue.delete(sender);
            }
        } catch (err) {
            logger.error('Error playing audio:', err);
            await sock.sendMessage(sender, { text: '*❌ Error:* Failed to play audio. Please try again.' });
        }
    }
};

const mediaCommands = {
    async reverse(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* Reply to a video with .reverse'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Reversing video...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

            await fs.writeFile(inputPath, buffer);

            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .videoFilters('reverse')
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: '✅ Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to reverse video. Please try again later.'
            });
        }
    },

    async enhance(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* Reply to an image with .enhance'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Enhancing image quality...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                await sharp(buffer)
                    .normalize() // Enhance contrast
                    .modulate({
                        brightness: 1.1,
                        saturation: 1.2
                    })
                    .sharpen({
                        sigma: 1.5,
                        m1: 1.5,
                        m2: 0.7
                    })
                    .png()
                    .toFile(outputPath);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: '✅ Here\'s your enhanced image!'
                });

                await fs.unlink(outputPath);
            } catch (processErr) {
                throw new Error(`Failed to enhance image: ${processErr.message}`);
            }

        } catch (err) {
            logger.error('Error in enhance command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to enhance image. Please try again later.'
            });
        }
    },

    async sharpen(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .sharpen [level]\n\n*Example:* .sharpen 5'
                });
                return;
            }

            const level = parseInt(args[0]) || 5;
            if (level < 1 || level > 10) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Sharpening level must be between 1 and 10'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Sharpening image...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                await sharp(buffer)
                    .sharpen({
                        sigma: level * 0.5,
                        m1: level * 0.2,
                        m2: level * 0.1
                    })
                    .png()
                    .toFile(outputPath);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: `✅ Image sharpened with level ${level}!`
                });

                await fs.unlink(outputPath);
            } catch (processErr) {
                throw new Error(`Failed to sharpen image: ${processErr.message}`);
            }

        } catch (err) {
            logger.error('Error in sharpen command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to sharpen image. Please try again later.'
            });
        }
    }
};

module.exports = mediaCommands;