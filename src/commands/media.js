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
const yts = require('yt-search'); // Added import for yts
const { getLyrics } = require('genius-lyrics-api'); // Added import for genius-lyrics-api
const webp = require('node-webpmux');


const playNextInQueue = async (sock, sender) => {
    const queue = audioQueue.get(sender);
    if (queue.length > 0) {
        const audioBuffer = queue.shift();
        try {
            await sock.sendMessage(sender, { audio: { url: audioBuffer } });
            if(queue.length > 0) {
                setTimeout(() => playNextInQueue(sock, sender), 1000); // Short delay to simulate smooth playback
            } else {
                audioQueue.delete(sender);
            }
        } catch (err) {
            logger.error('Error playing audio:', err);
            await sock.sendMessage(sender, { text: 'Error playing audio. Try again.' });
        }
    }
};


const mediaCommands = {
    async sticker(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage && !message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Please send an image or short video with caption .sticker' 
                });
                return;
            }

            // Create temp directory if it doesn't exist
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            // Download media
            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const inputPath = path.join(tempDir, `input_${Date.now()}`);
            const outputPath = path.join(tempDir, `${Date.now()}.webp`);

            try {
                // Save input buffer
                await fs.writeFile(inputPath, buffer);

                if (message.message.imageMessage) {
                    // Process image to sticker
                    await sharp(buffer)
                        .resize(512, 512, {
                            fit: 'contain',
                            background: { r: 0, g: 0, b: 0, alpha: 0 }
                        })
                        .webp()
                        .toFile(outputPath);

                    // Add metadata
                    await writeExifToWebp(outputPath, {
                        packname: config.sticker?.packname || "WhatsApp Bot",
                        author: config.sticker?.author || "Made with ❤️"
                    });

                    // Send sticker
                    await sock.sendMessage(remoteJid, { 
                        sticker: { url: outputPath }
                    });
                } else if (message.message.videoMessage) {
                    // Video sticker support
                    const ffmpeg = require('fluent-ffmpeg');
                    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
                    ffmpeg.setFfmpegPath(ffmpegPath);

                    // Convert video to WebP
                    await new Promise((resolve, reject) => {
                        ffmpeg(inputPath)
                            .inputFormat('mp4')
                            .on('error', reject)
                            .on('end', resolve)
                            .addOutputOptions([
                                "-vcodec", "libwebp",
                                "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
                                "-loop", "0",
                                "-ss", "00:00:00",
                                "-t", "00:00:05",
                                "-preset", "default",
                                "-an",
                                "-vsync", "0"
                            ])
                            .toFormat('webp')
                            .save(outputPath);
                    });

                    // Add metadata
                    await writeExifToWebp(outputPath, {
                        packname: config.sticker?.packname || "WhatsApp Bot",
                        author: config.sticker?.author || "Made with ❤️"
                    });

                    // Send sticker
                    await sock.sendMessage(remoteJid, { 
                        sticker: { url: outputPath }
                    });
                }
            } finally {
                // Cleanup temp files
                try {
                    await fs.unlink(inputPath);
                    await fs.unlink(outputPath);
                } catch (cleanupErr) {
                    logger.error('Error cleaning up temp files:', cleanupErr);
                }
            }
        } catch (err) {
            logger.error('Error in sticker command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to create sticker. Please ensure the media is valid.' 
            });
        }
    },
    async toimg(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.stickerMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please reply to a sticker'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: 'Here\'s your image!'
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in toimg command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to convert sticker to image.' });
        }
    },
    async brightness(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .brightness [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Brightness level must be between 0 and 200' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .modulate({
                    brightness: level / 100
                })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Adjusted brightness to ${level}%`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in brightness command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to adjust brightness.' });
        }
    },
    async contrast(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .contrast [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Contrast level must be between 0 and 200' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .modulate({
                    contrast: level / 100
                })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Adjusted contrast to ${level}%`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in contrast command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to adjust contrast.' });
        }
    },
    async blur(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .blur [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 5;
            if (level < 0.3 || level > 20) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Blur level must be between 0.3 and 20' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .blur(level)
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Applied blur effect with radius ${level}`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in blur command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to apply blur effect.' });
        }
    },
    async pixelate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .pixelate [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 8;
            if (level < 2 || level > 100) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Pixelation level must be between 2 and 100' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            // Get image dimensions first
            const metadata = await sharp(buffer).metadata();
            const width = metadata.width;
            const height = metadata.height;

            // Create pixelation effect by scaling down and up
            await sharp(buffer)
                .resize(Math.max(1, Math.floor(width / level)), 
                       Math.max(1, Math.floor(height / level)), 
                       { fit: 'fill' })
                .resize(width, height, { fit: 'fill', kernel: 'nearest' })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Applied pixelation effect with level ${level}`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in pixelate command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to pixelate image.' });
        }
    },
    async cartoon(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .cartoon'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                await sharp(buffer)
                    .median(5)
                    .normalize()
                    .modulate({
                        brightness: 1.1,
                        saturation: 1.5
                    })
                    .posterize(5)
                    .png()
                    .toFile(outputPath);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: 'Here\'s your cartoon effect!'
                });

                await fs.unlink(outputPath);
            } catch (err) {
                throw err;
            }

        } catch (err) {
            logger.error('Error in cartoon command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to apply cartoon effect. Please try again.' 
            });
        }
    },

    async painting(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .painting [style]'
                });
                return;
            }

            const style = args[0]?.toLowerCase() || 'oil';
            const validStyles = ['oil', 'watercolor'];

            if (!validStyles.includes(style)) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please choose a valid style: oil, watercolor'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                // Apply different effects based on style
                const sharpInstance = sharp(buffer);

                if (style === 'oil') {
                    await sharpInstance
                        .median(10)
                        .modulate({
                            brightness: 1.1,
                            saturation: 1.5
                        })
                        .gamma(1.5)
                        .png()
                        .toFile(outputPath);
                } else if (style === 'watercolor') {
                    await sharpInstance
                        .blur(2)
                        .modulate({
                            brightness: 1.1,
                            saturation: 1.2
                        })
                        .gamma(0.8)
                        .png()
                        .toFile(outputPath);
                }

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: `Here's your ${style} painting effect!`
                });

                await fs.unlink(outputPath);
            } catch (err) {
                throw err;
            }

        } catch (err) {
            logger.error('Error in painting command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to apply painting effect. Please try again.' 
            });
        }
    },

    async sketch(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .sketch [type]'
                });
                return;
            }

            const type = args[0]?.toLowerCase() || 'pencil';
            const validTypes = ['pencil', 'charcoal'];

            if (!validTypes.includes(type)) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please choose a valid type: pencil, charcoal'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                // Convert to grayscale and apply sketch effect
                const sharpInstance = sharp(buffer);

                if (type === 'pencil') {
                    await sharpInstance
                        .grayscale()
                        .normalize()
                        .modulate({
                            brightness: 1.1
                        })
                        .sharpen(2)
                        .png()
                        .toFile(outputPath);
                } else if (type === 'charcoal') {
                    await sharpInstance
                        .grayscale()
                        .normalize()
                        .modulate({
                            brightness: 0.9,
                            contrast: 1.2
                        })
                        .sharpen(3)
                        .png()
                        .toFile(outputPath);
                }

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: `Here's your ${type} sketch effect!`
                });

                await fs.unlink(outputPath);
            } catch (err) {
                throw err;
            }

        } catch (err) {
            logger.error('Error in sketch command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to apply sketch effect. Please try again.' 
            });
        }
    },

    async boomerang(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send a video with caption .boomerang'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
            const reversedPath = path.join(tempDir, `reversed_${Date.now()}.mp4`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

            await fs.writeFile(inputPath, buffer);

            // Get video duration
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            // First create reversed video
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .videoFilters('reverse')
                    .audioFilters('areverse')
                    .save(reversedPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Then concatenate original and reversed
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(inputPath)
                    .input(reversedPath)
                    .complexFilter(['concat=n=2:v=1:a=1'])
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: 'Here\'s your boomerang video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(reversedPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in boomerang command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to create boomerang effect. Please try again.' 
            });
        }
    },
    async resize(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .resize [width] [height]'
                });
                return;
            }

            const [width, height] = args.map(Number);
            if (!width || !height) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Please provide valid width and height values' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .resize(width, height, { fit: 'contain' })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Resized to ${width}x${height}`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in resize command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to resize image.' });
        }
    },
    async crop(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .crop [x] [y] [width] [height]'
                });
                return;
            }

            const [x, y, width, height] = args.map(Number);
            if (!x || !y || !width || !height) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Please provide valid x, y, width, and height values' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .extract({ left: x, top: y, width, height })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Cropped image to ${width}x${height} from position (${x},${y})`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in crop command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to crop image.' });
        }
    },
    async rotate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .rotate [degrees]'
                });
                return;
            }

            const degrees = parseInt(args[0]) || 90;
            // Normalize degrees to be between 0 and 360
            const normalizedDegrees = ((degrees % 360) + 360) % 360;

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .rotate(normalizedDegrees)
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Rotated image by ${normalizedDegrees}°`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in rotate command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to rotate image.' });
        }
    },
    async flip(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image with caption .flip [horizontal|vertical]'
                });
                return;
            }

            const direction = args[0]?.toLowerCase();
            if (!direction || !['horizontal', 'vertical'].includes(direction)) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Please specify horizontal or vertical' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .flip(direction === 'vertical')
                .flop(direction === 'horizontal')
                .png()
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Flipped image ${direction}ly`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in flip command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to flip image.' });
        }
    },
    async slow(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send a video with caption .slow [factor]'
                });
                return;
            }

            const factor = parseFloat(args[0]) || 0.5;
            if (factor <= 0 || factor > 1) {
                await sock.sendMessage(remoteJid, {
                    text: 'Speed factor must be between 0 and 1'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

            await fs.writeFile(inputPath, buffer);

            // Process video using fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .setFPS(30)
                    .videoFilters(`setpts=${1/factor}*PTS`)
                    .on('progress', (progress) => {
                        logger.info(`Processing: ${progress.percent}% done`);
                    })
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: `Slowed video by ${factor}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in slow command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
        }
    },
    async fast(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send a video with caption .fast [factor]'
                });
                return;
            }

            const factor = parseFloat(args[0]) || 2.0;
            if (factor < 1 || factor > 4) {
                await sock.sendMessage(remoteJid, {
                    text: 'Speed factor must be between 1 and 4'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

            await fs.writeFile(inputPath, buffer);

            // Process video using fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .setFPS(30)
                    .videoFilters(`setpts=${1/factor}*PTS`)
                    .on('progress', (progress) => {
                        logger.info(`Processing: ${progress.percent}% done`);
                    })
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: `Sped up video by ${factor}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in fast command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
        }
    },
    async reverse(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send a video with caption .reverse'
                });
                return;
            }

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
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
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
    },
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
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
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

            await fs.writeFile(inputPath, buffer);

            // Process video using fluent-ffmpeg
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
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
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
    },
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
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
    },
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process video.' });
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

            await fs.writeFile(inputPath, buffer);

            // Process video using fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .videoFilters('reverse')
                    .audioFilters('areverse')
                    .on('progress', (progress) => {
                        logger.info(`Processing: ${progress.percent}% done`);
                    })
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to reverse video. Make sure the video is in a supported format.' 
            });
        }
    },
    async boomerang2(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send a video with caption .boomerang'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}..mp4`);
            const reversedPath = path.join(tempDir, `reversed_${Date.now()}.mp4`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

            await fs.writeFile(inputPath, buffer);

            // Get video duration
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            // First create reversed video
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .videoFilters('reverse')
                    .audioFilters('areverse')
                    .save(reversedPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Then concatenate original and reversed
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(inputPath)
                    .input(reversedPath)
                    .complexFilter(['concat=n=2:v=1:a=1'])
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: 'Here\'s your boomerang video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(reversedPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in boomerang command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to create boomerang effect. Please try again.' 
            });
        }
    },
    async pitch(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.audioMessage && !message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an audio file with caption .pitch [level]\nLevel range: 0.5 to 2.0'
                });
                return;
            }

            const level = parseFloat(args[0]) || 1.0;
            if (level < 0.5 || level > 2.0) {
                await sock.sendMessage(remoteJid, {
                    text: 'Pitch level must be between 0.5 and 2.0'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, buffer);

            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters(`asetrate=44100*${level},aresample=44100`)
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            await sock.sendMessage(remoteJid, {
                audio: { url: outputPath },
                mimetype: 'audio/mp4',
                caption: `Audio pitch adjusted by ${level}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in pitch command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Failed to adjust audio pitch. Please try again.'
            });
        }
    },

    async tempo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.audioMessage && !message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an audio file with caption .tempo [speed]\nSpeed range: 0.5 to 2.0'
                });
                return;
            }

            const speed = parseFloat(args[0]) || 1.0;
            if (speed < 0.5 || speed > 2.0) {
                await sock.sendMessage(remoteJid, {
                    text: 'Tempo speed must be between 0.5 and 2.0'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, buffer);

            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters(`atempo=${speed}`)
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            await sock.sendMessage(remoteJid, {
                audio: { url: outputPath },
                mimetype: 'audio/mp4',
                caption: `Audio tempo adjusted to ${speed}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in tempo command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Failed to adjust audio tempo. Please try again.'
            });
        }
    },

    async echo(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.audioMessage && !message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an audio file with caption .echo [delay] [decay]\nDelay: 0.1-2.0, Decay: 0.1-0.9'
                });
                return;
            }

            const delay = parseFloat(args[0]) || 0.5;
            const decay = parseFloat(args[1]) || 0.5;

            if (delay < 0.1 || delay > 2.0 || decay < 0.1 || decay > 0.9) {
                await sock.sendMessage(remoteJid, {
                    text: 'Invalid parameters. Use:\nDelay: 0.1-2.0\nDecay: 0.1-0.9'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, buffer);

            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters([
                        {
                            filter: 'aecho',
                            options: {
                                'in_gain': 0.8,
                                'out_gain': decay,
                                'delays': delay * 1000,
                                'decays': decay
                            }
                        }
                    ])
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            await sock.sendMessage(remoteJid, {
                audio: { url: outputPath },
                mimetype: 'audio/mp4',
                caption: `Echo effect added (Delay: ${delay}s, Decay: ${decay})`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in echo command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Failed to add echo effect. Please try again.'
            });
        }
    },

    async bass(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.audioMessage && !message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an audio file with caption .bass [level]\nLevel range: 1-20'
                });
                return;
            }

            const level = parseInt(args[0]) || 5;
            if (level < 1 || level > 20) {
                await sock.sendMessage(remoteJid, {
                    text: 'Bass level must be between 1 and 20'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, buffer);

            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters([
                        {
                            filter: 'bass',
                            options: {
                                'gain': level,
                                'frequency': 100,
                                'width_type': 'h',
                                'width': 100
                            }
                        }
                    ])
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            await sock.sendMessage(remoteJid, {
                audio: { url: outputPath },
                mimetype: 'audio/mp4',
                caption: `Bass boosted by ${level}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in bass command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Failed to boost bass. Please try again.'
            });
        }
    },
    async tiktok(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .tiktok [video_url]\n\n*Example:* .tiktok https://vm.tiktok.com/xxx'
                });
                return;
            }

            const url = args[0];
            if (!url.match(/^https?:\/\/((?:vm|vt|www)\.)?tiktok\.com/)) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide a valid TikTok video URL'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading TikTok video...' });

            try {
                const response = await axios.get(`https://api.tikmate.app/api/lookup?url=${encodeURIComponent(url)}`);
                if (!response.data?.download_url) {
                    throw new Error('Failed to get download URL');
                }

                await sock.sendMessage(remoteJid, {
                    video: { url: response.data.download_url },
                    caption: '✅ Here\'s your TikTok video!'
                });
            } catch (downloadErr) {
                throw new Error(`Failed to download video: ${downloadErr.message}`);
            }

        } catch (err) {
            logger.error('Error in tiktok command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to download TikTok video. Please try again later.'
            });
        }
    },

    async instagram(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .instagram [post_url]\n\n*Example:* .instagram https://www.instagram.com/p/xxx'
                });
                return;
            }

            const url = args[0];
            if (!url.match(/^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//)) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide a valid Instagram post/reel URL'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading Instagram media...' });

            try {
                const response = await axios.get(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`);
                if (!response.data?.thumbnail_url) {
                    throw new Error('Failed to get media URL');
                }

                const mediaUrl = response.data.thumbnail_url.replace(/\?.*$/, '');
                await sock.sendMessage(remoteJid, {
                    image: { url: mediaUrl },
                    caption: '✅ Here\'s your Instagram media!'
                });
            } catch (downloadErr) {
                throw new Error(`Failed to download media: ${downloadErr.message}`);
            }

        } catch (err) {
            logger.error('Error in instagram command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to download Instagram media. Please try again later.'
            });
        }
    },

    async facebook(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .facebook [video_url]\n\n*Example:* .facebook https://www.facebook.com/watch?v=xxx'
                });
                return;
            }

            const url = args[0];
            if (!url.match(/^https?:\/\/(www\.)?(facebook|fb)\.com/)) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide a valid Facebook video URL'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading Facebook video...' });

            try {
                // Using a public Facebook video downloader API
                const response = await axios.get(`https://api.fbdownloader.net/api/extract?url=${encodeURIComponent(url)}`);
                if (!response.data?.url) {
                    throw new Error('Failed to get download URL');
                }

                await sock.sendMessage(remoteJid, {
                    video: { url: response.data.url },
                    caption: '✅ Here\'s your Facebook video!'
                });
            } catch (downloadErr) {
                throw new Error(`Failed to download video: ${downloadErr.message}`);
            }

        } catch (err) {
            logger.error('Error in facebook command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to download Facebook video. Please try again later.'
            });
        }
    },

    async twitter(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .twitter [tweet_url]\n\n*Example:* .twitter https://twitter.com/xxx/status/xxx'
                });
                return;
            }

            const url = args[0];
            if (!url.match(/^https?:\/\/(www\.)?twitter\.com/)) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide a valid Twitter post URL'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading Twitter media...' });

            try {
                // Using a public Twitter video downloader API
                const response = await axios.get(`https://api.twitter-video.download/api/extract?url=${encodeURIComponent(url)}`);
                if (!response.data?.url) {
                    throw new Error('Failed to get download URL');
                }

                // Check if it's a video or image
                const isVideo = response.data.type === 'video';
                if (isVideo) {
                    await sock.sendMessage(remoteJid, {
                        video: { url: response.data.url },
                        caption: '✅ Here\'s your Twitter video!'
                    });
                } else {
                    await sock.sendMessage(remoteJid, {
                        image: { url: response.data.url },
                        caption: '✅ Here\'s your Twitter image!'
                    });
                }
            } catch (downloadErr) {
                throw new Error(`Failed to download media: ${downloadErr.message}`);
            }

        } catch (err) {
            logger.error('Error in twitter command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to download Twitter media. Please try again later.'
            });
        }
    },
    async gimage(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .gimage [query]\n\n*Example:* .gimage cute cats'
                });
                return;
            }

            const query = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Searching Google images...' });

            try {
                // Using Google Custom Search API
                const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                    params: {
                        key: process.env.GOOGLE_API_KEY,
                        cx: process.env.GOOGLE_CSE_ID,
                        q: query,
                        searchType: 'image',
                        num: 1
                    }
                });

                if (!response.data?.items?.[0]?.link) {
                    throw new Error('No images found');
                }

                await sock.sendMessage(remoteJid, {
                    image: { url: response.data.items[0].link },
                    caption: `✅ Here's an image of "${query}"`
                });
            } catch (searchErr) {
                throw new Error(`Failed to search images: ${searchErr.message}`);
            }

        } catch (err) {
            logger.error('Error in gimage command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to search Google images. Please try again later.'
            });
        }
    },

    async pinterest(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .pinterest [query]\n\n*Example:* .pinterest aesthetic wallpapers'
                });
                return;
            }

            const query = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Searching Pinterest...' });

            try {
                // Using Pinterest API (you'll need to set up Pinterest API access)
                const response = await axios.get(`https://api.pinterest.com/v3/search/pins`, {
                    params: {
                        query: query,
                        access_token: process.env.PINTEREST_ACCESS_TOKEN,
                        limit: 1
                    }
                });

                if (!response.data?.items?.[0]?.image?.original?.url) {
                    throw new Error('No pins found');
                }

                await sock.sendMessage(remoteJid, {
                    image: { url: response.data.items[0].image.original.url },
                    caption: `✅ Here's a Pinterest image for "${query}"`
                });
            } catch (searchErr) {
                throw new Error(`Failed to search Pinterest: ${searchErr.message}`);
            }

        } catch (err) {
            logger.error('Error in pinterest command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to search Pinterest. Please try again later.'
            });
        }
    },

    async wallpaper(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .wallpaper [query]\n\n*Example:* .wallpaper nature 4k'
                });
                return;
            }

            const query = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Searching wallpapers...' });

            try {
                // Using Unsplash API for high-quality wallpapers
                const response = await axios.get('https://api.unsplash.com/search/photos', {
                    params: {
                        query: query,
                        client_id: process.env.UNSPLASH_ACCESS_KEY,
                        orientation: 'landscape',
                        per_page: 1
                    }
                });

                if (!response.data?.results?.[0]?.urls?.full) {
                    throw new Error('No wallpapers found');
                }

                await sock.sendMessage(remoteJid, {
                    image: { url: response.data.results[0].urls.full },
                    caption: `✅ Here's a wallpaper for "${query}"`
                });
            } catch (searchErr) {
                throw new Error(`Failed to search wallpapers: ${searchErr.message}`);
            }

        } catch (err) {
            logger.error('Error in wallpaper command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to search wallpapers. Please try again later.'
            });
        }
    },

    async removebg(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* Reply to an image with .removebg to remove its background'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Removing background...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});

            try {
                // Using remove.bg API
                const formData = new FormData();
                formData.append('image_file', buffer, { filename: 'image.png' });

                const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
                    headers: {
                        'X-Api-Key': process.env.REMOVE_BG_API_KEY,
                        ...formData.getHeaders()
                    },
                    responseType: 'arraybuffer'
                });

                await sock.sendMessage(remoteJid, {
                    image: { url: response.data },
                    caption: '✅ Here\'s your image with background removed!'
                });
            } catch (processErr) {
                throw new Error(`Failed to remove background: ${processErr.message}`);
            }

        } catch (err) {
            logger.error('Error in removebg command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to remove background. Please try again later.'
            });
        }
    },

    async deepfry(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* Reply to an image with .deepfry'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Deep frying image...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                await sharp(buffer)
                    .modulate({
                        brightness: 1.2,
                        saturation: 2.5
                    })
                    .sharpen(10)
                    .jpeg({
                        quality: 15,
                        force: true
                    })
                    .toFile(outputPath);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: '✅ Here\'s your deep fried image!'
                });

                await fs.unlink(outputPath);
            } catch (processErr) {
                throw new Error(`Failed to deep fry image: ${processErr.message}`);
            }

        } catch (err) {
            logger.error('Error in deepfry command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to deep fry image. Please try again later.'
            });
        }
    },

    async caption(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage || !args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* Reply to an image with .caption [text]'
                });
                return;
            }

            const captionText = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Adding caption...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                // Get image dimensions
                const metadata = await sharp(buffer).metadata();
                const { width, height } = metadata;

                // Create text overlay
                const svgText = `
                    <svg width="${width}" height="${height}">
                        <style>
                            .title { fill: white; font-size: 40px; font-weight: bold; }
                        </style>
                        <text 
                            x="50%" 
                            y="90%" 
                            text-anchor="middle" 
                            class="title"
                            stroke="black"
                            stroke-width="2"
                        >${captionText}</text>
                    </svg>`;

                await sharp(buffer)
                    .composite([{
                        input: Buffer.from(svgText),
                        top: 0,
                        left: 0
                    }])
                    .png()
                    .toFile(outputPath);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: '✅ Here\'s your captioned image!'
                });

                await fs.unlink(outputPath);
            } catch (processErr) {
                throw new Error(`Failed to add caption: ${processErr.message}`);
            }

        } catch (err) {
            logger.error('Error in caption command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to add caption. Please try again later.'
            });
        }
    },

    async meme(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage || args.length < 2) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* Reply to an image with .meme [top text] | [bottom text]'
                });
                return;
            }

            const [topText, bottomText] = args.join(' ').split('|').map(text => text.trim());
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Creating meme...' });

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            try {
                // Get image dimensions
                const metadata = await sharp(buffer).metadata();
                const { width, height } = metadata;

                // Create text overlays
                const svgText = `
                    <svg width="${width}" height="${height}">
                        <style>
                            .meme-text { 
                                fill: white; 
                                font-size: 50px; 
                                font-weight: bold;
                                font-family: Impact;
                            }
                        </style>
                        <text 
                            x="50%" 
                            y="10%" 
                            text-anchor="middle" 
                            class="meme-text"
                            stroke="black"
                            stroke-width="2"
                        >${topText.toUpperCase()}</text>
                        <text 
                            x="50%" 
                            y="90%" 
                            text-anchor="middle" 
                            class="meme-text"
                            stroke="black"
                            stroke-width="2"
                        >${bottomText.toUpperCase()}</text>
                    </svg>`;

                await sharp(buffer)
                    .composite([{
                        input: Buffer.from(svgText),
                        top: 0,
                        left: 0
                    }])
                    .png()
                    .toFile(outputPath);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: '✅ Here\'s your meme!'
                });

                await fs.unlink(outputPath);
            } catch (processErr) {
                throw new Error(`Failed to create meme: ${processErr.message}`);
            }

        } catch (err) {
            logger.error('Error in meme command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to create meme. Please try again later.'
            });
        }
    },
    async ytmp4(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .ytmp4 [video_url]\n\n*Example:* .ytmp4 https://youtube.com/watch?v=xxx'
                });
                return;
            }

            const url = args[0];
            if (!ytdl.validateURL(url)) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide a valid YouTube URL'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading YouTube video...' });

            try {
                const info = await ytdl.getInfo(url);
                const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });

                // Download video
                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const outputPath = path.join(tempDir, `${Date.now()}.mp4`);

                await new Promise((resolve, reject) => {
                    ytdl(url, { format: format })
                        .pipe(fs.createWriteStream(outputPath))
                        .on('finish', resolve)
                        .on('error', reject);
                });

                await sock.sendMessage(remoteJid, {
                    video: { url: outputPath },
                    caption: `✅ *Title:* ${info.videoDetails.title}\n*Duration:* ${Math.floor(info.videoDetails.lengthSeconds / 60)}:${(info.videoDetails.lengthSeconds % 60).toString().padStart(2, '0')}`
                });

                await fs.unlink(outputPath);
            } catch (downloadErr) {
                throw new Error(`Failed to download video: ${downloadErr.message}`);
            }

        } catch (err) {
            logger.error('Error in ytmp4 command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to download YouTube video. Please try again later.'
            });
        }
    },

    async ytmp3(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .ytmp3 [video_url]\n\n*Example:* .ytmp3 https://youtube.com/watch?v=xxx'
                });
                return;
            }

            const url = args[0];
            if (!ytdl.validateURL(url)) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide a validYouTube URL'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Downloading YouTube audio...' });

            try {
                const info = await ytdl.getInfo(url);
                const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const outputPath = path.join(tempDir, `${Date.now()}.mp3`);

                await new Promise((resolve, reject) => {
                    ytdl(url, { format: format })
                        .pipe(fs.createWriteStream(outputPath))
                        .on('finish', resolve)
                        .on('error', reject);
                });

                await sock.sendMessage(remoteJid, {
                    audio: { url: outputPath },
                    mimetype: 'audio/mp4',
                    caption: `✅ *Title:* ${info.videoDetails.title}\n*Duration:* ${Math.floor(info.videoDetails.lengthSeconds / 60)}:${(info.videoDetails.lengthSeconds % 60).toString().padStart(2, '0')}`
                });

                await fs.unlink(outputPath);
            } catch (downloadErr) {
                throw new Error(`Failed to download audio: ${downloadErr.message}`);
            }

        } catch (err) {
            logger.error('Error in ytmp3 command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to download YouTube audio. Please try again later.'
            });
        }
    },

    async play(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .play [song name/URL]\n\n*Example:* .play despacito'
                });
                return;
            }

            const query = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Searching for song...' });

            try {
                let url = query;
                if (!ytdl.validateURL(query)) {
                    // Search for the video if URL not provided
                    const searchResults = await yts(query);
                    if (!searchResults.videos.length) {
                        throw new Error('No videos found');
                    }
                    url = searchResults.videos[0].url;
                }

                const info = await ytdl.getInfo(url);
                const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const outputPath = path.join(tempDir, `${Date.now()}.mp3`);

                await new Promise((resolve, reject) => {
                    ytdl(url, { format: format })
                        .pipe(fs.createWriteStream(outputPath))
                        .on('finish', resolve)
                        .on('error', reject);
                });

                await sock.sendMessage(remoteJid, {
                    audio: { url: outputPath },
                    mimetype: 'audio/mp4',
                    caption: `✅ *Now Playing:* ${info.videoDetails.title}\n*Duration:* ${Math.floor(info.videoDetails.lengthSeconds / 60)}:${(info.videoDetails.lengthSeconds % 60).toString().padStart(2, '0')}`
                });

                await fs.unlink(outputPath);
            } catch (playErr) {
                throw new Error(`Failed to play audio: ${playErr.message}`);
            }

        } catch (err) {
            logger.error('Error in play command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to play audio. Please try again later.'
            });
        }
    },

    async video(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .video [video name/URL]\n\n*Example:* .video despacito'
                });
                return;
            }

            const query = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Searching for video...' });

            try {
                let url = query;
                if (!ytdl.validateURL(query)) {
                    // Search for the video if URL not provided
                    const searchResults = await yts(query);
                    if (!searchResults.videos.length) {
                        throw new Error('No videos found');
                    }
                    url = searchResults.videos[0].url;
                }

                const info = await ytdl.getInfo(url);
                const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });

                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const outputPath = path.join(tempDir, `${Date.now()}.mp4`);

                await new Promise((resolve, reject) => {
                    ytdl(url, { format: format })
                        .pipe(fs.createWriteStream(outputPath))
                        .on('finish', resolve)
                        .on('error', reject);
                });

                await sock.sendMessage(remoteJid, {
                    video: { url: outputPath },
                    caption: `✅ *Now Playing:* ${info.videoDetails.title}\n*Duration:* ${Math.floor(info.videoDetails.lengthSeconds / 60)}:${(info.videoDetails.lengthSeconds % 60).toString().padStart(2, '0')}`
                });

                await fs.unlink(outputPath);
            } catch (playErr) {
                throw new Error(`Failed to play video: ${playErr.message}`);
            }

        } catch (err) {
            logger.error('Error in video command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to play video. Please try again later.'
            });
        }
    },

    async lyrics(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .lyrics [song name]\n\n*Example:* .lyrics despacito'
                });
                return;
            }

            const query = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Searching for lyrics...' });

            try {
                const options = {
                    apiKey: process.env.GENIUS_ACCESS_TOKEN,
                    title: query,
                    optimizeQuery: true
                };

                const lyrics = await getLyrics(options);
                if (!lyrics) {
                    throw new Error('Lyrics not found');
                }

                // Split lyrics into chunks if too long
                const maxLength = 4000;
                const chunks = lyrics.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];

                for (let i = 0; i < chunks.length; i++) {
                    const messageText = i === 0 ?
                        `*🎵 Lyrics for:* ${query}\n\n${chunks[i]}` :
                        chunks[i];

                    await sock.sendMessage(remoteJid, { text: messageText });
                }
            } catch (searchErr) {
                throw new Error(`Failed to find lyrics: ${searchErr.message}`);
            }

        } catch (err) {
            logger.error('Error in lyrics command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to find lyrics. Please try again later.'
            });
        }
    },
    async emojimix(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .emojimix 😀+😭\n\n*Example:* Mix two emojis together'
                });
                return;
            }

            const [emoji1, emoji2] = args[0].split('+');
            if (!emoji1 || !emoji2) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error:* Please provide two emojis separated by +\n*Example:* 😀+😭'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Mixing emojis...' });

            try {
                const url = `https://tenor.googleapis.com/v2/featured?key=${process.env.TENOR_API_KEY}&contentfilter=high&media_filter=png_transparent&q=${encodeURIComponent(emoji1 + emoji2)}`;
                const response = await axios.get(url);

                if (!response.data?.results?.[0]?.media_formats?.png?.url) {
                    throw new Error('No mixed emoji found');
                }

                const imageUrl = response.data.results[0].media_formats.png.url;
                const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imageResponse.data);

                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const stickerPath = path.join(tempDir, `${Date.now()}.webp`);

                await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toFile(stickerPath);

                await writeExifToWebp(stickerPath, {
                    packname: "WhatsApp Bot",
                    author: "Made with ❤️"
                });

                await sock.sendMessage(remoteJid, {
                    sticker: { url: stickerPath }
                });

                await fs.unlink(stickerPath);
            } catch (mixErr) {
                throw new Error(`Failed to mix emojis: ${mixErr.message}`);
            }

        } catch (err) {
            logger.error('Error in emojimix command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to mix emojis. Please try again later.'
            });
        }
    },

    async ttp(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .ttp [text]\n\n*Example:* .ttp Hello World'
                });
                return;
            }

            const text = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Creating text sticker...' });

            try {
                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const stickerPath = path.join(tempDir, `${Date.now()}.webp`);

                // Create text image using sharp
                const svgText = `
                    <svg width="512" height="512">
                        <style>
                            .title { fill: white; font-size: 48px; font-weight: bold; }
                        </style>
                        <rect width="100%" height="100%" fill="black"/>
                        <text 
                            x="50%" 
                            y="50%" 
                            text-anchor="middle" 
                            dominant-baseline="middle"
                            class="title"
                        >${text}</text>
                    </svg>`;

                await sharp(Buffer.from(svgText))
                    .resize(512, 512)
                    .webp()
                    .toFile(stickerPath);

                await writeExifToWebp(stickerPath, {
                    packname: "WhatsApp Bot",
                    author: "Made with ❤️"
                });

                await sock.sendMessage(remoteJid, {
                    sticker: { url: stickerPath }
                });

                await fs.unlink(stickerPath);
            } catch (createErr) {
                throw new Error(`Failed to create text sticker: ${createErr.message}`);
            }

        } catch (err) {
            logger.error('Error in ttp command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to create text sticker. Please try again later.'
            });
        }
    },

    async attp(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!args.length) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .attp [text]\n\n*Example:* .attp Hello World'
                });
                return;
            }

            const text = args.join(' ');
            await sock.sendMessage(remoteJid, { text: '*⏳ Processing:* Creating animated text sticker...' });

            try {
                const tempDir = path.join(__dirname, '../../temp');
                await fs.mkdir(tempDir, { recursive: true });
                const stickerPath = path.join(tempDir, `${Date.now()}.webp`);

                // Create animated text using multiple frames
                const frames = [];
                const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

                for (let i = 0; i < colors.length; i++) {
                    const svgText = `
                        <svg width="512" height="512">
                            <style>
                                .title { fill: ${colors[i]}; font-size: 48px; font-weight: bold; }
                            </style>
                            <rect width="100%" height="100%" fill="black"/>
                            <text 
                                x="50%" 
                                y="50%" 
                                text-anchor="middle" 
                                dominant-baseline="middle"
                                class="title"
                            >${text}</text>
                        </svg>`;

                    frames.push(sharp(Buffer.from(svgText)).resize(512, 512));
                }

                // Create animated WebP
                const frameBuffers = await Promise.all(frames.map(frame => frame.webp().toBuffer()));

                // Combine frames into animated WebP
                const encoder = new webp.AnimEncoder();
                encoder.setRepeat(0);
                encoder.setDelay(500);
                encoder.setQuality(80);

                frameBuffers.forEach(buffer => {
                    encoder.addFrame(buffer);
                });

                await fs.writeFile(stickerPath, encoder.encode());

                await writeExifToWebp(stickerPath, {
                    packname: "WhatsApp Bot",
                    author: "Made with ❤️"
                });

                await sock.sendMessage(remoteJid, {
                    sticker: { url: stickerPath }
                });

                await fs.unlink(stickerPath);
            } catch (createErr) {
                throw new Error(`Failed to create animated text sticker: ${createErr.message}`);
            }

        } catch (err) {
            logger.error('Error in attp command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to create animated text sticker. Please try again later.'
            });
        }
    }
};

module.exports = mediaCommands;