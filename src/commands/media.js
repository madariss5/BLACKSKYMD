const logger = require('../utils/logger');
const config = require('../config/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { writeExifToWebp } = require('../utils/stickerMetadata');

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
    async pitch(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const level = parseFloat(args[0]) || 1.0;
        // TODO: Implement pitch adjustment
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async tempo(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const speed = parseFloat(args[0]) || 1.0;
        // TODO: Implement tempo adjustment
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async echo(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const delay = parseInt(args[0]) || 100;
        // TODO: Implement echo effect
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async bass(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const level = parseInt(args[0]) || 5;
        // TODO: Implement bass boost
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async tiktok(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const url = args[0];
            if (!url || !url.includes('tiktok.com')) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Please provide a valid TikTok URL' 
                });
                return;
            }

            // Basic URL validation
            if (!url.match(/https?:\/\/(www\.)?tiktok\.com\/.*$/)) {
                await sock.sendMessage(remoteJid, {
                    text: 'Invalid TikTok URL format'
                });
                return;
            }

            await sock.sendMessage(remoteJid, {
                text: 'Downloading TikTok video...'
            });

            // TODO: Implement TikTok download using a reliable API
            await sock.sendMessage(remoteJid, {
                text: 'TikTok download feature will be available soon!'
            });

        } catch (err) {
            logger.error('Error in tiktok command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to download TikTok video.' });
        }
    },
    async instagram(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const url = args[0];
        if (!url) {
            await sock.sendMessage(remoteJid, { text: 'Please provide an Instagram URL' });
            return;
        }
        // TODO: Implement Instagram media download
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async facebook(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const url = args[0];
        if (!url) {
            await sock.sendMessage(remoteJid, { text: 'Please provide a Facebook URL' });
            return;
        }
        // TODO: Implement Facebook video download
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async twitter(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const url = args[0];
        if (!url) {
            await sock.sendMessage(remoteJid, { text: 'Please provide a Twitter URL' });
            return;
        }
        // TODO: Implement Twitter media download
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async gimage(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!config.apis.google) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Google API key not configured.' 
                });
                return;
            }
            const query = args.join(' ');
            if (!query) {
                await sock.sendMessage(remoteJid, { 
                    text: 'Please provide a search term' 
                });
                return;
            }
            // TODO: Implement Google image search
            await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
        } catch (err) {
            logger.error('Error in gimage command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to search images.' });
        }
    },
    async pinterest(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(remoteJid, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement Pinterest image search
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async wallpaper(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(remoteJid, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement wallpaper search
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async trim(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.videoMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send a video with caption .trim [start_time] [end_time] (in seconds)'
                });
                return;
            }

            const [startTime, endTime] = args.map(Number);
            if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime || startTime < 0) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please provide valid start and end times in seconds'
                });
                return;
            }

            // Get video duration
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

            // Get video duration first
            const duration = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(inputPath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata.format.duration);
                });
            });

            if (endTime > duration) {
                await fs.unlink(inputPath);
                await sock.sendMessage(remoteJid, {
                    text: `Video is only ${Math.floor(duration)} seconds long. Please provide a valid end time.`
                });
                return;
            }

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .setStartTime(startTime)
                    .setDuration(endTime - startTime)
                    .output(outputPath)
                    .on('progress', (progress) => {
                        logger.info(`Processing: ${progress.percent}% done`);
                    })
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            await sock.sendMessage(remoteJid, {
                video: { url: outputPath },
                caption: `Trimmed video from ${startTime}s to ${endTime}s`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in trim command:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Failed to trim video. Make sure the video is in a supported format and the time values are valid.' 
            });

            // Cleanup in case of error
            try {
                if (inputPath) await fs.unlink(inputPath);
                if (outputPath) await fs.unlink(outputPath);
            } catch (cleanupErr) {
                logger.error('Error during cleanup:', cleanupErr);
            }
        }
    },
    async speed(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const speed = parseFloat(args[0]) || 1.0;
        // TODO: Implement video speed adjustment
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async mp3(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement video to MP3 conversion
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async play(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const sender = message.key.remoteJid; 
            if (!message.message?.audioMessage && !message.message?.videoMessage && args.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please provide a YouTube URL or reply to an audio message'
                });
                return;
            }

            // Initialize queue for this chat if it doesn't exist
            if (!audioQueue.has(sender)) {
                audioQueue.set(sender, []);
            }

            const queue = audioQueue.get(sender);
            let audioBuffer;

            if (args.length > 0) {
                // Download from YouTube
                const url = args[0];
                if (!url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
                    await sock.sendMessage(remoteJid, {
                        text: 'Please provide a valid YouTube URL'
                    });
                    return;
                }

                await sock.sendMessage(remoteJid, {
                    text: 'Downloading audio from YouTube...'
                });

                try {                    const response = await axios({
                        url: args[0],
                        responseType: 'arraybuffer'
                    });
                    const tempDir = path.join(__dirname, '../../temp');
                    await fs.mkdir(tempDir, { recursive: true });
                    const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
                    await fs.writeFile(inputPath, response.data);
                    audioBuffer = await fs.readFile(inputPath);
                    await fs.unlink(inputPath);
                } catch (err) {
                    await sock.sendMessage(remoteJid, {
                        text: 'Failed to download audio from YouTube'
                    });
                    return;
                }
            } else {
                // Use replied audio message
                audioBuffer = await downloadMediaMessage(message, 'buffer', {});
            }

            // Add to queue
            queue.push(audioBuffer);
            await sock.sendMessage(remoteJid, {
                text: `Added to queue. Position: ${queue.length}`
            });

            // If it's the only item, start playing
            if (queue.length === 1) {
                await playNextInQueue(sock, sender);
            }

        } catch (err) {
            logger.error('Error in play command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to play audio.' });
        }
    },
    async pause(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement pause functionality
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async resume(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement resume functionality
        await sock.sendMessage(remoteJid, { text: 'NOT_IMPLEMENTED_MSG' });
    },
    async stop(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            const sender = message.key.remoteJid; 
            if (!audioQueue.has(sender)) {
                await sock.sendMessage(remoteJid, {
                    text: 'No audio is currently playing'
                });
                return;
            }

            // Clear the queue
            audioQueue.set(sender, []);
            await sock.sendMessage(remoteJid, {
                text: 'Stopped playback and cleared queue'
            });

        } catch (err) {
            logger.error('Error in stop command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to stop playback.' });
        }
    },
    async queue(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            const sender = message.key.remoteJid; 
            if (!audioQueue.has(sender) || audioQueue.get(sender).length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: 'The queue is empty'
                });
                return;
            }

            const queue = audioQueue.get(sender);
            const queueStatus = `Current queue length: ${queue.length}`;
            await sock.sendMessage(remoteJid, { text: queueStatus });

        } catch (err) {
            logger.error('Error in queue command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to get queue status.' });
        }
    },
    async removebg(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!config.apis.removebg) {
                await sock.sendMessage(remoteJid, {
                    text: 'Remove.bg API key not configured'
                });
                return;
            }

            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image to remove its background'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.png`);
            await fs.writeFile(inputPath, buffer);

            try {
                const response = await axios({
                    method: 'post',
                    url: 'https://api.remove.bg/v1.0/removebg',
                    data: {
                        image_file: await fs.readFile(inputPath),
                        size: 'auto'
                    },
                    headers: {
                        'X-Api-Key': config.apis.removebg
                    },
                    responseType: 'arraybuffer'
                });

                const outputPath = path.join(tempDir, `output_${Date.now()}.png`);
                await fs.writeFile(outputPath, response.data);

                await sock.sendMessage(remoteJid, {
                    image: { url: outputPath },
                    caption: 'Background removed!'
                });

                // Cleanup
                await fs.unlink(inputPath);
                await fs.unlink(outputPath);

            } catch (apiErr) {
                logger.error('Error with remove.bg API:', apiErr);
                await sock.sendMessage(remoteJid, {
                    text: 'Failed to remove background. Please try again later.'
                });
            }

        } catch (err) {
            logger.error('Error in removebg command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to process image.' });
        }
    },
    async deepfry(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image to deep fry'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);

            // Apply deep fry effect
            await sharp(buffer)
                .modulate({
                    brightness: 1.2,
                    saturation: 2.5
                })
                .sharpen(10, 5, 10)
                .jpeg({
                    quality: 15,
                    force: true
                })
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: '🔥 Deep fried!'
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in deepfry command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to deep fry image.' });
        }
    },
    async compress(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please send an image to compress'
                });
                return;
            }

            const quality = parseInt(args[0]) || 50;
            if (quality < 1 || quality > 100) {
                await sock.sendMessage(remoteJid, {
                    text: 'Quality must be between 1 and 100'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.jpg`);

            await sharp(buffer)
                .jpeg({
                    quality: quality,
                    force: true
                })
                .toFile(outputPath);

            await sock.sendMessage(remoteJid, {
                image: { url: outputPath },
                caption: `Compressed with ${quality}% quality`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in compress command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: 'Failed to compress image.' });
        }
    }
};

// Add command configurations
for (const [name, handler] of Object.entries(mediaCommands)) {
    handler.config = {
        name,
        description: `${name} command`,
        usage: `.${name}`,
        cooldown: 3,
        permissions: ['user']
    };
}

module.exports = mediaCommands;