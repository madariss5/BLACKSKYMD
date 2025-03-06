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
    async play(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* Reply with audio or provide a YouTube URL/search term' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*🔍 Searching:* Looking for your requested audio...' });

            let audioUrl;
            if (args[0].startsWith('http')) {
                // Direct URL provided
                audioUrl = args[0];
            } else {
                // Search YouTube
                const searchResults = await yts(args.join(' '));
                if (!searchResults.videos.length) {
                    await sock.sendMessage(remoteJid, { text: '*❌ Error:* No results found' });
                    return;
                }
                audioUrl = searchResults.videos[0].url;
            }

            const stream = ytdl(audioUrl, { filter: 'audioonly' });
            const chunks = [];

            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                await sock.sendMessage(remoteJid, { 
                    audio: { url: buffer },
                    mimetype: 'audio/mp4'
                });
            });

        } catch (err) {
            logger.error('Error in play command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to play audio' });
        }
    },

    async sticker(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage && !message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* Reply to an image/video with .sticker' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Creating sticker...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.webp`);

            await fs.writeFile(inputPath, buffer);

            // Convert to WebP
            await sharp(buffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                sticker: { url: outputPath }
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in sticker command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to create sticker' });
        }
    },

    async toimg(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.stickerMessage) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* Reply to a sticker with .toimg' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Converting sticker to image...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            await sharp(buffer)
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: '✅ Here\'s your image!'
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in toimg command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to convert sticker to image' });
        }
    },

    async ytmp3(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args[0]) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* .ytmp3 [YouTube URL]' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading audio...' });

            const stream = ytdl(args[0], { filter: 'audioonly' });
            const chunks = [];

            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                await sock.sendMessage(remoteJid, { 
                    audio: { url: buffer },
                    mimetype: 'audio/mp4'
                });
            });

        } catch (err) {
            logger.error('Error in ytmp3 command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to download audio' });
        }
    },

    async ytmp4(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args[0]) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* .ytmp4 [YouTube URL]' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading video...' });

            const stream = ytdl(args[0], { filter: 'videoandaudio' });
            const chunks = [];

            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                await sock.sendMessage(remoteJid, { 
                    video: { url: buffer }
                });
            });

        } catch (err) {
            logger.error('Error in ytmp4 command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to download video' });
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
                    .normalize()
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
    },

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

    async ttp(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* .ttp [text]' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Creating text sticker...' });

            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            const outputPath = path.join(tempDir, `${Date.now()}.webp`);

            // Create text image using Sharp
            const svgImage = `
                <svg width="512" height="512">
                    <style>
                        text {
                            font-family: Arial, sans-serif;
                            font-size: 48px;
                            font-weight: bold;
                            fill: white;
                        }
                    </style>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)"/>
                    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${text}</text>
                </svg>
            `;

            await sharp(Buffer.from(svgImage))
                .resize(512, 512)
                .webp()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                sticker: { url: outputPath }
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in ttp command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to create text sticker' });
        }
    },

    async attp(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(remoteJid, { text: '*📝 Usage:* .attp [text]' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Creating animated text sticker...' });

            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            const outputPath = path.join(tempDir, `${Date.now()}.webp`);

            // Create animated text image using Sharp
            const frames = [];
            const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

            for (let i = 0; i < colors.length; i++) {
                const svgImage = `
                    <svg width="512" height="512">
                        <style>
                            text {
                                font-family: Arial, sans-serif;
                                font-size: 48px;
                                font-weight: bold;
                                fill: ${colors[i]};
                            }
                        </style>
                        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)"/>
                        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${text}</text>
                    </svg>
                `;

                const frameBuffer = await sharp(Buffer.from(svgImage))
                    .resize(512, 512)
                    .webp()
                    .toBuffer();

                frames.push(frameBuffer);
            }

            // Create animated WebP
            const img = new webp.Image();
            for (let i = 0; i < frames.length; i++) {
                await img.addFrame(frames[i], {
                    delay: 100, // 100ms delay between frames
                    dispose: 1
                });
            }
            await img.save(outputPath);

            await sock.sendMessage(remoteJid, {
                sticker: { url: outputPath }
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in attp command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to create animated text sticker' });
        }
    },

    async emojimix(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const emojis = args.join('').split('+');

            if (emojis.length !== 2) {
                await sock.sendMessage(remoteJid, { 
                    text: '*📝 Usage:* .emojimix [emoji1]+[emoji2]\nExample: .emojimix 😀+😭' 
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Mixing emojis...' });

            // Use Emoji Kitchen API
            const emojiUrl = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/${encodeURIComponent(emojis[0])}/${encodeURIComponent(emojis[0])}_${encodeURIComponent(emojis[1])}.png`;

            const response = await axios.get(emojiUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);

            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            const outputPath = path.join(tempDir, `${Date.now()}.webp`);

            // Convert to WebP sticker
            await sharp(buffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                sticker: { url: outputPath }
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in emojimix command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '*❌ Error:* Failed to mix emojis' });
        }
    }
};

module.exports = mediaCommands;