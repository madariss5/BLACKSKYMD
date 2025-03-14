/**
 * Media Effects Utility
 * Provides centralized implementation of common media manipulation effects
 * Used to consolidate duplicate media commands across modules
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const Jimp = require('jimp');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

/**
 * Create temporary directory for processing media
 * @returns {Promise<string>} Path to temp directory
 */
async function ensureTempDir() {
  const tempDir = path.join(process.cwd(), 'temp');
  try {
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  } catch (error) {
    logger.error('Error creating temp directory:', error);
    throw error;
  }
}

/**
 * Generate a random filename for temporary files
 * @param {string} extension File extension
 * @returns {string} Random filename with extension
 */
function getRandomFileName(extension = 'jpg') {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
}

/**
 * Check if file exists
 * @param {string} filePath Path to check
 * @returns {Promise<boolean>} Whether file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply blur effect to an image
 * @param {Buffer|string} input Input image buffer or path
 * @param {number} intensity Blur intensity (1-100)
 * @returns {Promise<string>} Path to processed image
 */
async function applyBlur(input, intensity = 5) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    // Ensure valid intensity value
    const blurValue = Math.min(Math.max(intensity, 1), 100);
    
    if (typeof input === 'string') {
      // Process file path
      await sharp(input)
        .blur(blurValue)
        .toFile(outputPath);
    } else {
      // Process buffer
      await sharp(input)
        .blur(blurValue)
        .toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    logger.error('Error applying blur effect:', error);
    throw error;
  }
}

/**
 * Rotate an image
 * @param {Buffer|string} input Input image buffer or path
 * @param {number} degrees Rotation degrees
 * @returns {Promise<string>} Path to processed image
 */
async function rotateImage(input, degrees = 90) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    // Normalize degrees to 0-360
    const normalizedDegrees = ((degrees % 360) + 360) % 360;
    
    if (typeof input === 'string') {
      await sharp(input)
        .rotate(normalizedDegrees)
        .toFile(outputPath);
    } else {
      await sharp(input)
        .rotate(normalizedDegrees)
        .toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    logger.error('Error rotating image:', error);
    throw error;
  }
}

/**
 * Flip an image horizontally or vertically
 * @param {Buffer|string} input Input image buffer or path
 * @param {string} direction Flip direction ('horizontal', 'vertical', or 'both')
 * @returns {Promise<string>} Path to processed image
 */
async function flipImage(input, direction = 'horizontal') {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    let sharpInstance;
    
    if (typeof input === 'string') {
      sharpInstance = sharp(input);
    } else {
      sharpInstance = sharp(input);
    }
    
    if (direction === 'horizontal' || direction === 'both') {
      sharpInstance = sharpInstance.flop();
    }
    
    if (direction === 'vertical' || direction === 'both') {
      sharpInstance = sharpInstance.flip();
    }
    
    await sharpInstance.toFile(outputPath);
    return outputPath;
  } catch (error) {
    logger.error('Error flipping image:', error);
    throw error;
  }
}

/**
 * Negate an image (invert colors)
 * @param {Buffer|string} input Input image buffer or path
 * @returns {Promise<string>} Path to processed image
 */
async function negateImage(input) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    if (typeof input === 'string') {
      await sharp(input)
        .negate()
        .toFile(outputPath);
    } else {
      await sharp(input)
        .negate()
        .toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    logger.error('Error negating image:', error);
    throw error;
  }
}

/**
 * Apply a tint/color overlay to an image
 * @param {Buffer|string} input Input image buffer or path
 * @param {string} color Color name or hex code
 * @returns {Promise<string>} Path to processed image
 */
async function tintImage(input, color = 'red') {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    // Convert named colors to hex if needed
    const colorMap = {
      red: '#FF0000',
      blue: '#0000FF',
      green: '#00FF00',
      yellow: '#FFFF00',
      purple: '#800080',
      cyan: '#00FFFF',
      magenta: '#FF00FF'
    };
    
    const hexColor = colorMap[color.toLowerCase()] || color;
    
    // Convert image to buffer if it's a file path
    let inputBuffer;
    if (typeof input === 'string') {
      inputBuffer = await fs.readFile(input);
    } else {
      inputBuffer = input;
    }
    
    // Process with Jimp which has better tinting support
    const image = await Jimp.read(inputBuffer);
    
    // Parse hex color
    let r = 0, g = 0, b = 0;
    if (hexColor.startsWith('#')) {
      const hex = hexColor.substring(1);
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    
    // Apply tint
    image.color([
      { apply: 'red', params: [r] },
      { apply: 'green', params: [g] },
      { apply: 'blue', params: [b] }
    ]);
    
    // Save the image
    await image.writeAsync(outputPath);
    
    return outputPath;
  } catch (error) {
    logger.error('Error tinting image:', error);
    throw error;
  }
}

/**
 * Change video playback speed
 * @param {string} inputPath Path to input video
 * @param {number} speed Speed multiplier (0.5 = half speed, 2 = double speed)
 * @returns {Promise<string>} Path to processed video
 */
async function changeVideoSpeed(inputPath, speed = 1) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName('mp4'));
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`setpts=${1/speed}*PTS`)
      .audioFilters(`atempo=${speed}`)
      .output(outputPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Error changing video speed:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Trim a video or audio file
 * @param {string} inputPath Path to input video/audio
 * @param {number} startTime Start time in seconds
 * @param {number} duration Duration in seconds
 * @returns {Promise<string>} Path to processed file
 */
async function trimMedia(inputPath, startTime = 0, duration = 10) {
  const tempDir = await ensureTempDir();
  const extension = path.extname(inputPath);
  const outputPath = path.join(tempDir, getRandomFileName(extension.substring(1)));
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Error trimming media:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Convert sticker to image
 * @param {string} stickerPath Path to WebP sticker
 * @returns {Promise<string>} Path to converted image
 */
async function stickerToImage(stickerPath) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName('png'));
  
  try {
    await sharp(stickerPath)
      .toFormat('png')
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    logger.error('Error converting sticker to image:', error);
    throw error;
  }
}

/**
 * Sharpen an image
 * @param {Buffer|string} input Input image buffer or path
 * @param {number} intensity Sharpen intensity (1-100)
 * @returns {Promise<string>} Path to processed image
 */
async function sharpenImage(input, intensity = 50) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    // Convert intensity to sharp parameters (0.5-5)
    const sharpenValue = (intensity / 100) * 4.5 + 0.5;
    
    if (typeof input === 'string') {
      await sharp(input)
        .sharpen(sharpenValue)
        .toFile(outputPath);
    } else {
      await sharp(input)
        .sharpen(sharpenValue)
        .toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    logger.error('Error sharpening image:', error);
    throw error;
  }
}

/**
 * Adjust image brightness
 * @param {Buffer|string} input Input image buffer or path
 * @param {number} level Brightness level (-100 to 100)
 * @returns {Promise<string>} Path to processed image
 */
async function adjustBrightness(input, level = 0) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    // Convert level to sharp parameter (0-3)
    const brightnessFactor = (level + 100) / 100;
    
    if (typeof input === 'string') {
      await sharp(input)
        .modulate({ brightness: brightnessFactor })
        .toFile(outputPath);
    } else {
      await sharp(input)
        .modulate({ brightness: brightnessFactor })
        .toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    logger.error('Error adjusting brightness:', error);
    throw error;
  }
}

/**
 * Adjust image contrast
 * @param {Buffer|string} input Input image buffer or path
 * @param {number} level Contrast level (-100 to 100)
 * @returns {Promise<string>} Path to processed image
 */
async function adjustContrast(input, level = 0) {
  const tempDir = await ensureTempDir();
  const outputPath = path.join(tempDir, getRandomFileName());
  
  try {
    // Convert level to sharp parameter (1-5)
    const contrastFactor = ((level + 100) / 50) + 0.5;
    
    if (typeof input === 'string') {
      await sharp(input)
        .linear(contrastFactor, -(128 * contrastFactor) + 128)
        .toFile(outputPath);
    } else {
      await sharp(input)
        .linear(contrastFactor, -(128 * contrastFactor) + 128)
        .toFile(outputPath);
    }
    
    return outputPath;
  } catch (error) {
    logger.error('Error adjusting contrast:', error);
    throw error;
  }
}

/**
 * Reverse a video or audio file
 * @param {string} inputPath Path to input file
 * @param {boolean} reverseAudio Whether to reverse audio too
 * @returns {Promise<string>} Path to processed file
 */
async function reverseMedia(inputPath, reverseAudio = true) {
  const tempDir = await ensureTempDir();
  const extension = path.extname(inputPath);
  const isAudio = ['.mp3', '.wav', '.ogg', '.m4a'].includes(extension.toLowerCase());
  const outputPath = path.join(tempDir, getRandomFileName(extension.substring(1)));
  
  if (isAudio) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters('areverse')
        .output(outputPath)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Error reversing audio:', err);
          reject(err);
        })
        .run();
    });
  } else {
    // For video
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoFilters('reverse');
      
      if (reverseAudio) {
        command = command.audioFilters('areverse');
      }
      
      command.output(outputPath)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Error reversing video:', err);
          reject(err);
        })
        .run();
    });
  }
}

module.exports = {
  applyBlur,
  rotateImage,
  flipImage,
  negateImage,
  tintImage,
  changeVideoSpeed,
  trimMedia,
  stickerToImage,
  sharpenImage,
  adjustBrightness,
  adjustContrast,
  reverseMedia,
  ensureTempDir,
  getRandomFileName,
  fileExists
};