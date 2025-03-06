const logger = require('../utils/logger');
const config = require('../config/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const mediaCommands = {
    // Sticker Commands
    async sticker(sock, sender, message) {
        try {
            if (!message.message?.imageMessage && !message.message?.videoMessage) {
                await sock.sendMessage(sender, { 
                    text: 'Please send an image or short video with caption .sticker' 
                });
                return;
            }

            const media = message.message.imageMessage || message.message.videoMessage;
            const buffer = await downloadMediaMessage(message, 'buffer', {});

            // Create temp directory if it doesn't exist
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            // Process image/video to webp
            const outputPath = path.join(tempDir, `${Date.now()}.webp`);

            if (message.message.imageMessage) {
                await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp()
                    .toFile(outputPath);
            } else {
                // TODO: Implement video to animated webp conversion
                await sock.sendMessage(sender, { 
                    text: 'Video sticker support coming soon!' 
                });
                return;
            }

            // Send the sticker
            await sock.sendMessage(sender, { 
                sticker: { url: outputPath }
            });

            // Cleanup
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in sticker command:', err);
            await sock.sendMessage(sender, { text: 'Failed to create sticker.' });
        }
    },

    async toimg(sock, sender, message) {
        try {
            if (!message.message?.stickerMessage) {
                await sock.sendMessage(sender, {
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: 'Here\'s your image!'
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in toimg command:', err);
            await sock.sendMessage(sender, { text: 'Failed to convert sticker to image.' });
        }
    },

    // Image Effects
    async brightness(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .brightness [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Adjusted brightness to ${level}%`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in brightness command:', err);
            await sock.sendMessage(sender, { text: 'Failed to adjust brightness.' });
        }
    },

    async contrast(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .contrast [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Adjusted contrast to ${level}%`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in contrast command:', err);
            await sock.sendMessage(sender, { text: 'Failed to adjust contrast.' });
        }
    },

    async saturate(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .saturate [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(sender, { 
                    text: 'Saturation level must be between 0 and 200' 
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .modulate({
                    saturation: level / 100
                })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Adjusted saturation to ${level}%`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in saturate command:', err);
            await sock.sendMessage(sender, { text: 'Failed to adjust saturation.' });
        }
    },

    async hue(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .hue [degrees]'
                });
                return;
            }

            const degrees = parseInt(args[0]) || 0;
            // Normalize degrees to be between 0 and 360
            const normalizedDegrees = ((degrees % 360) + 360) % 360;

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const outputPath = path.join(tempDir, `${Date.now()}.png`);
            await sharp(buffer)
                .modulate({
                    hue: normalizedDegrees
                })
                .png()
                .toFile(outputPath);

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Rotated hue by ${normalizedDegrees}°`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in hue command:', err);
            await sock.sendMessage(sender, { text: 'Failed to adjust hue.' });
        }
    },

    async blur(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .blur [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 5;
            if (level < 0.3 || level > 20) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Applied blur effect with radius ${level}`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in blur command:', err);
            await sock.sendMessage(sender, { text: 'Failed to apply blur effect.' });
        }
    },
    async pixelate(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .pixelate [level]'
                });
                return;
            }

            const level = parseInt(args[0]) || 8;
            if (level < 2 || level > 100) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Applied pixelation effect with level ${level}`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in pixelate command:', err);
            await sock.sendMessage(sender, { text: 'Failed to pixelate image.' });
        }
    },

    // Artistic Effects
    async cartoon(sock, sender) {
        // TODO: Implement cartoon effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async painting(sock, sender, args) {
        const style = args[0] || 'oil';
        // TODO: Implement painting effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async sketch(sock, sender, args) {
        const type = args[0] || 'pencil';
        // TODO: Implement sketch effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },

    // Image Manipulation
    async resize(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .resize [width] [height]'
                });
                return;
            }

            const [width, height] = args.map(Number);
            if (!width || !height) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Resized to ${width}x${height}`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in resize command:', err);
            await sock.sendMessage(sender, { text: 'Failed to resize image.' });
        }
    },
    async crop(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .crop [x] [y] [width] [height]'
                });
                return;
            }

            const [x, y, width, height] = args.map(Number);
            if (!x || !y || !width || !height) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Cropped image to ${width}x${height} from position (${x},${y})`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in crop command:', err);
            await sock.sendMessage(sender, { text: 'Failed to crop image.' });
        }
    },

    async rotate(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Rotated image by ${normalizedDegrees}°`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in rotate command:', err);
            await sock.sendMessage(sender, { text: 'Failed to rotate image.' });
        }
    }
    ,
    async flip(sock, sender, args, message) {
        try {
            if (!message.message?.imageMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send an image with caption .flip [horizontal|vertical]'
                });
                return;
            }

            const direction = args[0]?.toLowerCase();
            if (!direction || !['horizontal', 'vertical'].includes(direction)) {
                await sock.sendMessage(sender, { 
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

            await sock.sendMessage(sender, {
                image: { url: outputPath },
                caption: `Flipped image ${direction}ly`
            });

            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in flip command:', err);
            await sock.sendMessage(sender, { text: 'Failed to flip image.' });
        }
    },

    // Video Effects
    async slow(sock, sender, args, message) {
        try {
            if (!message.message?.videoMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send a video with caption .slow [factor]'
                });
                return;
            }

            const factor = parseFloat(args[0]) || 0.5;
            if (factor <= 0 || factor > 1) {
                await sock.sendMessage(sender, {
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
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(sender, {
                video: { url: outputPath },
                caption: `Slowed video by ${factor}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in slow command:', err);
            await sock.sendMessage(sender, { text: 'Failed to process video.' });
        }
    },

    async fast(sock, sender, args, message) {
        try {
            if (!message.message?.videoMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send a video with caption .fast [factor]'
                });
                return;
            }

            const factor = parseFloat(args[0]) || 2.0;
            if (factor < 1 || factor > 4) {
                await sock.sendMessage(sender, {
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
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(sender, {
                video: { url: outputPath },
                caption: `Sped up video by ${factor}x`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in fast command:', err);
            await sock.sendMessage(sender, { text: 'Failed to process video.' });
        }
    }
    ,
    async reverse(sock, sender, message) {
        try {
            if (!message.message?.videoMessage) {
                await sock.sendMessage(sender, {
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
                    .save(outputPath)
                    .on('progress', (progress) => {
                        logger.info(`Processing: ${progress.percent}% done`);
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            await sock.sendMessage(sender, {
                video: { url: outputPath },
                caption: 'Here\'s your reversed video!'
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in reverse command:', err);
            await sock.sendMessage(sender, { 
                text: 'Failed to reverse video. Make sure the video is in a supported format.' 
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
    async boomerang(sock, sender) {
        // TODO: Implement boomerang effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },

    // Audio Effects
    async pitch(sock, sender, args) {
        const level = parseFloat(args[0]) || 1.0;
        // TODO: Implement pitch adjustment
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async tempo(sock, sender, args) {
        const speed = parseFloat(args[0]) || 1.0;
        // TODO: Implement tempo adjustment
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async echo(sock, sender, args) {
        const delay = parseInt(args[0]) || 100;
        // TODO: Implement echo effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async bass(sock, sender, args) {
        const level = parseInt(args[0]) || 5;
        // TODO: Implement bass boost
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },

    // Social Media Downloads
    async tiktok(sock, sender, args) {
        try {
            const url = args[0];
            if (!url || !url.includes('tiktok.com')) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide a valid TikTok URL' 
                });
                return;
            }

            // Basic URL validation
            if (!url.match(/https?:\/\/(www\.)?tiktok\.com\/.*$/)) {
                await sock.sendMessage(sender, {
                    text: 'Invalid TikTok URL format'
                });
                return;
            }

            await sock.sendMessage(sender, {
                text: 'Downloading TikTok video...'
            });

            // TODO: Implement TikTok download using a reliable API
            await sock.sendMessage(sender, {
                text: 'TikTok download feature will be available soon!'
            });

        } catch (err) {
            logger.error('Error in tiktok command:', err);
            await sock.sendMessage(sender, { text: 'Failed to download TikTok video.' });
        }
    },
    async instagram(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide an Instagram URL' });
            return;
        }
        // TODO: Implement Instagram media download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async facebook(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a Facebook URL' });
            return;
        }
        // TODO: Implement Facebook video download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async twitter(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a Twitter URL' });
            return;
        }
        // TODO: Implement Twitter media download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },

    // Media Search
    async gimage(sock, sender, args) {
        try {
            if (!config.apis.google) {
                await sock.sendMessage(sender, { 
                    text: 'Google API key not configured.' 
                });
                return;
            }
            const query = args.join(' ');
            if (!query) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide a search term' 
                });
                return;
            }
            // TODO: Implement Google image search
            await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
        } catch (err) {
            logger.error('Error in gimage command:', err);
            await sock.sendMessage(sender, { text: 'Failed to search images.' });
        }
    },
    async pinterest(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement Pinterest image search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async wallpaper(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement wallpaper search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async trim(sock, sender, args, message) {
        try {
            if (!message.message?.videoMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send a video with caption .trim [start_time] [end_time] (in seconds)'
                });
                return;
            }

            const [startTime, endTime] = args.map(Number);
            if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime || startTime < 0) {
                await sock.sendMessage(sender, {
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
                await sock.sendMessage(sender, {
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

            await sock.sendMessage(sender, {
                video: { url: outputPath },
                caption: `Trimmed video from ${startTime}s to ${endTime}s`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in trim command:', err);
            await sock.sendMessage(sender, { 
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

    async speed(sock, sender, args) {
        const speed = parseFloat(args[0]) || 1.0;
        // TODO: Implement video speed adjustment
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async mp3(sock, sender) {
        // TODO: Implement video to MP3 conversion
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    audioQueue: new Map(), // Store queues for different chats

    async play(sock, sender, args, message) {
        try {
            if (!message.message?.audioMessage && !message.message?.videoMessage && args.length === 0) {
                await sock.sendMessage(sender, {
                    text: 'Please send an audio file or provide a URL to play'
                });
                return;
            }

            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            let inputPath;

            if (message.message?.audioMessage || message.message?.videoMessage) {
                // Handle uploaded audio/video file
                const buffer = await downloadMediaMessage(message, 'buffer', {});
                inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
                await fs.writeFile(inputPath, buffer);
            } else if (args[0]) {
                // Handle URL
                try {
                    const response = await axios({
                        method: 'get',
                        url: args[0],
                        responseType: 'arraybuffer'
                    });
                    inputPath = path.jointempDir, `input_${Date.now()}.mp3`);
                    await fs.writeFile(inputPath, response.data);
                } catch (err) {
                    await sock.sendMessage(sender, {
                        text: 'Failed to download audio from URL. Please ensure it\'s a valid audio link.'
                    });
                    return;
                }
            }

            // Process audio using fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            // Convert to mp3 format if needed
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .on('progress', (progress) => {
                        logger.info(`Processing: ${progress.percent}% done`);
                    })
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            // Send processed audio
            await sock.sendMessage(sender, {
                audio: { url: outputPath },
                mimetype: 'audio/mp3',
                ptt: false // Set to true for voice notes
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in play command:', err);
            await sock.sendMessage(sender, { text: 'Failed to play audio.' });
        }
    },

    async pause(sock, sender) {
        try {
            // Since WhatsApp doesn't support real-time audio control,
            // we'll send a message explaining this limitation
            await sock.sendMessage(sender, {
                text: 'WhatsApp does not support pausing ongoing audio playback. Please stop and replay the audio instead.'
            });
        } catch (err) {
            logger.error('Error in pause command:', err);
            await sock.sendMessage(sender, { text: 'Failed to execute pause command.' });
        }
    },

    async resume(sock, sender) {
        try {
            // Similar to pause, explain the limitation
            await sock.sendMessage(sender, {
                text: 'WhatsApp does not support resuming audio playback. Please play the audio again.'
            });
        } catch (err) {
            logger.error('Error in resume command:', err);
            await sock.sendMessage(sender, { text: 'Failed to execute resume command.' });
        }
    },

    async stop(sock, sender) {
        try {
            // Explain the limitation
            await sock.sendMessage(sender, {
                text: 'WhatsApp does not support stopping ongoing audio playback. The audio will play until completion or you can close the chat.'
            });
        } catch (err) {
            logger.error('Error in stop command:', err);
            await sock.sendMessage(sender, { text: 'Failed to execute stop command.' });
        }
    },

    // Queue system for playlist management
    

    async queue(sock, sender, args) {
        try {
            if (!this.audioQueue.has(sender)) {
                this.audioQueue.set(sender, []);
            }

            const queue = this.audioQueue.get(sender);

            if (!args.length) {
                // Display queue
                if (queue.length === 0) {
                    await sock.sendMessage(sender, {
                        text: 'The playlist is empty. Add songs using .queue add [url]'
                    });
                    return;
                }

                const queueList = queue.map((song, index) => 
                    `${index + 1}. ${song.title || song.url}`
                ).join('\n');

                await sock.sendMessage(sender, {
                    text: `Current Playlist:\n${queueList}`
                });
                return;
            }

            const action = args[0].toLowerCase();
            const url = args[1];

            switch (action) {
                case 'add':
                    if (!url) {
                        await sock.sendMessage(sender, {
                            text: 'Please provide a URL to add to the queue'
                        });
                        return;
                    }
                    queue.push({ url });
                    await sock.sendMessage(sender, {
                        text: 'Added to playlist!'
                    });
                    break;

                case 'remove':
                    const index = parseInt(args[1]) - 1;
                    if (isNaN(index) || index < 0 || index >= queue.length) {
                        await sock.sendMessage(sender, {
                            text: 'Please provide a valid track number to remove'
                        });
                        return;
                    }
                    queue.splice(index, 1);
                    await sock.sendMessage(sender, {
                        text: 'Removed from playlist!'
                    });
                    break;

                case 'clear':
                    queue.length = 0;
                    await sock.sendMessage(sender, {
                        text: 'Playlist cleared!'
                    });
                    break;

                default:
                    await sock.sendMessage(sender, {
                        text: 'Invalid queue command. Use: add, remove, clear, or no argument to view queue'
                    });
            }
        } catch (err) {
            logger.error('Error in queue command:', err);
            await sock.sendMessage(sender, { text: 'Failed to manage queue.' });
        }
    },

    async volume(sock, sender, args, message) {
        try {
            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(sender, {
                    text: 'Volume level must be between 0 and 200'
                });
                return;
            }

            // Since WhatsApp doesn't support real-time volume control,
            // we'll need to process the audio file with the new volume
            if (!message.message?.audioMessage && !message.message?.videoMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please reply to an audio message to adjust its volume'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, buffer);

            // Process audio using fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters(`volume=${level/100}`)
                    .toFormat('mp3')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            await sock.sendMessage(sender, {
                audio: { url: outputPath },
                mimetype: 'audio/mp3',
                ptt: false
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in volume command:', err);
            await sock.sendMessage(sender, { text: 'Failed to adjust volume.' });
        }
    },

    // Social Media Downloads
    async tiktok(sock, sender, args) {
        try {
            const url = args[0];
            if (!url || !url.includes('tiktok.com')) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide a valid TikTok URL' 
                });
                return;
            }

            // Basic URL validation
            if (!url.match(/https?:\/\/(www\.)?tiktok\.com\/.*$/)) {
                await sock.sendMessage(sender, {
                    text: 'Invalid TikTok URL format'
                });
                return;
            }

            await sock.sendMessage(sender, {
                text: 'Downloading TikTok video...'
            });

            // TODO: Implement TikTok download using a reliable API
            await sock.sendMessage(sender, {
                text: 'TikTok download feature will be available soon!'
            });

        } catch (err) {
            logger.error('Error in tiktok command:', err);
            await sock.sendMessage(sender, { text: 'Failed to download TikTok video.' });
        }
    },
    async instagram(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide an Instagram URL' });
            return;
        }
        // TODO: Implement Instagram media download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async facebook(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a Facebook URL' });
            return;
        }
        // TODO: Implement Facebook video download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async twitter(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a Twitter URL' });
            return;
        }
        // TODO: Implement Twitter media download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },

    // Media Search
    async gimage(sock, sender, args) {
        try {
            if (!config.apis.google) {
                await sock.sendMessage(sender, { 
                    text: 'Google API key not configured.' 
                });
                return;
            }
            const query = args.join(' ');
            if (!query) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide a search term' 
                });
                return;
            }
            // TODO: Implement Google image search
            await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
        } catch (err) {
            logger.error('Error in gimage command:', err);
            await sock.sendMessage(sender, { text: 'Failed to search images.' });
        }
    },
    async pinterest(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement Pinterest image search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async wallpaper(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement wallpaper search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async trim(sock, sender, args, message) {
        try {
            if (!message.message?.videoMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please send a video with caption .trim [start_time] [end_time] (in seconds)'
                });
                return;
            }

            const [startTime, endTime] = args.map(Number);
            if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime || startTime < 0) {
                await sock.sendMessage(sender, {
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
                await sock.sendMessage(sender, {
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

            await sock.sendMessage(sender, {
                video: { url: outputPath },
                caption: `Trimmed video from ${startTime}s to ${endTime}s`
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in trim command:', err);
            await sock.sendMessage(sender, { 
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

    async speed(sock, sender, args) {
        const speed = parseFloat(args[0]) || 1.0;
        // TODO: Implement video speed adjustment
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async mp3(sock, sender) {
        // TODO: Implement video to MP3 conversion
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async volume(sock, sender, args, message) {
        try {
            const level = parseInt(args[0]) || 100;
            if (level < 0 || level > 200) {
                await sock.sendMessage(sender, {
                    text: 'Volume level must be between 0 and 200'
                });
                return;
            }

            // Since WhatsApp doesn't support real-time volume control,
            // we'll need to process the audio file with the new volume
            if (!message.message?.audioMessage && !message.message?.videoMessage) {
                await sock.sendMessage(sender, {
                    text: 'Please reply to an audio message to adjust its volume'
                });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });

            const inputPath = path.join(tempDir, `input_${Date.now()}.mp3`);
            const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);

            await fs.writeFile(inputPath, buffer);

            // Process audio using fluent-ffmpeg
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters(`volume=${level/100}`)
                    .toFormat('mp3')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            await sock.sendMessage(sender, {
                audio: { url: outputPath },
                mimetype: 'audio/mp3',
                ptt: false
            });

            // Cleanup
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);

        } catch (err) {
            logger.error('Error in volume command:', err);
            await sock.sendMessage(sender, { text: 'Failed to adjust volume.' });
        }
    },

    async remix(sock, sender) {
        // TODO: Implement audio remix
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async removebg(sock, sender) {
        // TODO: Implement background removal
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async deepfry(sock, sender) {
        // TODO: Implement deep fry effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async caption(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide caption text' });
            return;
        }
        // TODO: Implement caption addition
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async meme(sock, sender, args) {
        const [topText, bottomText] = args.join(' ').split('|').map(text => text.trim());
        if (!topText || !bottomText) {
            await sock.sendMessage(sender, { text: 'Please provide top and bottom text separated by |' });
            return;
        }
        // TODO: Implement meme creation
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async stickersearch(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement sticker search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async stickerpack(sock, sender, args) {
        const packName = args.join(' ');
        if (!packName) {
            await sock.sendMessage(sender, { text: 'Please provide a sticker pack name' });
            return;
        }
        // TODO: Implement sticker pack download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async compress(sock, sender, args) {
        const quality = parseInt(args[0]) || 80;
        // TODO: Implement image compression
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async enhance(sock, sender) {
        // TODO: Implement image enhancement
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async invert(sock, sender) {
        // TODO: Implement color inversion
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });    },
    async sharpen(sock, sender, args) {
        const level = parseInt(args[0]) || 5;
        // TODO: Implement image sharpening
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async vintage(sock, sender) {
        // TODO: Implement vintage filter
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async oil(sock, sender) {
        // TODO: Implement oil painting effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async glitch(sock, sender) {
        // TODO: Implement glitch effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async distort(sock, sender, args) {
        const level = parseInt(args[0]) || 5;
        // TODO: Implement distortion effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async textart(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to convert' });
            return;
        }
        // TODO: Implement ASCII art generation
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async gradient(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to style' });
            return;
        }
        // TODO: Implement gradient text effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async neon(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to style' });
            return;
        }
        // TODO: Implement neon text effect
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async emojimix(sock, sender, args) {
        const emojis = args[0]?.split('+');
        if (!emojis || emojis.length !== 2) {
            await sock.sendMessage(sender, { text: 'Please provide two emojis separated by +' });
            return;
        }
        // TODO: Implement emoji mixing
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async ttp(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to convert' });
            return;
        }
        // TODO: Implement text to picture
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async attp(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to convert' });
            return;
        }
        // TODO: Implement animated text to picture
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async ytmp4(sock, sender, args) {
        try {
            const url = args[0];
            if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide a valid YouTube URL' 
                });
                return;
            }
            // TODO: Implement YouTube video download
            await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
        } catch (err) {
            logger.error('Error in ytmp4 command:', err);
            await sock.sendMessage(sender, { text: 'Failed to download YouTube video.' });
        }
    },
    async ytmp3(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a YouTube URL' });
            return;
        }
        // TODO: Implement YouTube audio download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async play(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a song name' });
            return;
        }
        // TODO: Implement YouTube music search and play
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async video(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a video name' });
            return;
        }
        // TODO: Implement YouTube video search and play
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async soundcloud(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a SoundCloud URL' });
            return;
        }
        // TODO: Implement SoundCloud audio download
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async lyrics(sock, sender, args) {        const song = args.join(' ');
        if (!song) {
            await sock.sendMessage(sender, { text: 'Please provide a song name' });
            return;
        }
        // TODO: Implement lyrics search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async movie(sock, sender, args) {
        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: 'Please provide a movie title' });
            return;
        }
        // TODO: Implement movie info search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async series(sock, sender, args) {
        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: 'Please provide a series title' });
            return;
        }
        // TODO: Implement TV series info search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async animestyle(sock, sender) {
        // TODO: Implement anime style conversion
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async cartoonize(sock, sender) {
        // TODO: Implement cartoonization
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async artstyle(sock, sender, args) {
        const style = args[0];
        const styles = ['vangogh', 'picasso', 'monet', 'abstract'];

        if (!style || !styles.includes(style.toLowerCase())) {
            await sock.sendMessage(sender, { 
                text: `Please specify avalid style: ${styles.join(', ')}` 
            });
            return;
        }
        // TODO: Implement art style transfer
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async drake(sock, sender, args) {
        const [topText, bottomText] = args.join(' ').split('|').map(text => text.trim());
        if (!topText || !bottomText) {
            await sock.sendMessage(sender, { text: 'Please provide two texts separated by |' });
            return;
        }
        // TODO: Implement Drake meme creation
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async brain(sock, sender, args) {
        const texts = args.join(' ').split('|').map(text => text.trim());
        if (texts.length < 2) {
            await sock.sendMessage(sender, { text: 'Please provide at least 2 texts separated by |' });
            return;
        }
        // TODO: Implement expanding brain meme creation
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async waifu(sock, sender, args) {
        const category = args[0] || 'sfw';
        const categories = ['sfw', 'nsfw'];

        if (!categories.includes(category)) {
            await sock.sendMessage(sender, { 
                text: `Please specify a valid category: ${categories.join(', ')}` 
            });
            return;
        }
        // TODO: Implement waifu image fetching
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async neko(sock, sender) {
        // TODO: Implement neko image fetching
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async animesearch(sock, sender, args) {
        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: 'Please provide an anime title' });
            return;
        }
        // TODO: Implement anime search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },
    async mangasearch(sock, sender, args) {
        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: 'Please provide a manga title' });
            return;
        }
        // TODO: Implement manga search
        await sock.sendMessage(sender, { text: NOT_IMPLEMENTED_MSG });
    },

    // Default handler for unimplemented commands
    async defaultHandler(sock, sender, command) {
        await sock.sendMessage(sender, { 
            text: `The ${command} command will be available soon! Stay tuned for updates.`
        });
    }
};

// Add default handler for all unimplemented commands
const commands = require('../config/commands/media.json').commands;
for (const command of commands) {
    if (!mediaCommands[command.name]) {
        mediaCommands[command.name] = async (sock, sender) => {
            await mediaCommands.defaultHandler(sock, sender, command.name);
        };
    }
}

module.exports = mediaCommands;