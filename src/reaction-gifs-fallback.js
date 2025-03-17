/**
 * Reaction GIFs Fallback System
 * 
 * This module provides a network-based fallback system for reaction GIFs
 * enabling the reaction commands to work even when local GIFs are missing.
 * 
 * On Heroku and cloud platforms where the local GIF files might not be available,
 * this system will automatically fetch and serve GIFs from reliable public sources.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Base GIF directory
const GIF_DIRECTORY = path.join(__dirname, '../data/reaction_gifs');

// Fallback URLs for each reaction GIF
const FALLBACK_URLS = {
  // Positive reactions
  'hug.gif': 'https://c.tenor.com/9e1aE_xBLCsAAAAC/anime-hug.gif',
  'pat.gif': 'https://c.tenor.com/edS9BTB2zcQAAAAC/nogamenolife-headpat.gif',
  'kiss.gif': 'https://c.tenor.com/I7EzlN5BxoMAAAAC/anime-kiss.gif',
  'wave.gif': 'https://c.tenor.com/F-WWMVK9wx0AAAAC/wave-anime.gif',
  'dance.gif': 'https://c.tenor.com/lpbfKJpS7rgAAAAC/dance-anime.gif',
  'cry.gif': 'https://c.tenor.com/35hmBwYp9gcAAAAC/anime-cry.gif',
  'blush.gif': 'https://c.tenor.com/t5JvZ-Z2wkQAAAAC/blush-anime.gif',
  'laugh.gif': 'https://c.tenor.com/XZqoHAZx-RwAAAAC/anime-funny.gif',
  'wink.gif': 'https://c.tenor.com/AdJ-KzeK1lwAAAAC/anime-wink.gif',
  'poke.gif': 'https://c.tenor.com/3dOqO4vVlr8AAAAC/anime-poke.gif',
  
  // Negative reactions
  'slap.gif': 'https://c.tenor.com/rVXByOZKidMAAAAd/anime-slap.gif',
  'bonk.gif': 'https://c.tenor.com/CrmEU2LKix8AAAAC/anime-bonk.gif',
  'bite.gif': 'https://c.tenor.com/TKpmh4WFQ08AAAAC/bite-anime.gif',
  'punch.gif': 'https://c.tenor.com/SwMgGqBirvcAAAAC/saki-saki-kanojo-mo-kanojo.gif',
  'highfive.gif': 'https://c.tenor.com/JBBZ9mQntx8AAAAC/anime-high-five.gif',
  'yeet.gif': 'https://c.tenor.com/1ZNlTLpP_yQAAAAC/yeet-anime.gif',
  'kill.gif': 'https://c.tenor.com/NbBCakbfZnkAAAAC/kill-stab.gif',
  
  // Additional reactions as needed
  'bully.gif': 'https://c.tenor.com/uTreZ-Mzv_QAAAAC/anime-poke.gif',
  'cuddle.gif': 'https://c.tenor.com/ItpTQW2UKPYAAAAC/cuddle-hug.gif',
  'smug.gif': 'https://c.tenor.com/PeJyQRCSHHkAAAAC/spongebob-evil.gif',
  'lick.gif': 'https://c.tenor.com/PeeGQoLZuTUAAAAC/anime-zero-two.gif'
};

/**
 * Ensure the reaction GIFs directory exists
 * @returns {Promise<string>} Path to the GIF directory
 */
async function ensureGifDirectory() {
  try {
    if (!fs.existsSync(GIF_DIRECTORY)) {
      fs.mkdirSync(GIF_DIRECTORY, { recursive: true });
      console.log(`Created GIF directory: ${GIF_DIRECTORY}`);
    }
    return GIF_DIRECTORY;
  } catch (error) {
    console.error(`Error creating GIF directory: ${error.message}`);
    throw error;
  }
}

/**
 * Download a single GIF from a URL and save to local filesystem
 * @param {string} gifName Name of the GIF file
 * @param {string} url URL to download from
 * @param {string} directory Directory to save to
 * @returns {Promise<boolean>} Success status
 */
async function downloadGif(gifName, url, directory) {
  try {
    console.log(`Downloading ${gifName} from ${url}`);
    
    // Create a write stream to save the file
    const filePath = path.join(directory, gifName);
    const writer = fs.createWriteStream(filePath);
    
    // Download the file
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    // Pipe the response to the file
    response.data.pipe(writer);
    
    // Return a promise that resolves when the file is downloaded
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Successfully downloaded ${gifName}`);
        resolve(true);
      });
      
      writer.on('error', (error) => {
        console.error(`Error downloading ${gifName}: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error downloading ${gifName}: ${error.message}`);
    return false;
  }
}

/**
 * Download all missing reaction GIFs
 * @returns {Promise<{success: number, failed: number}>} Results of download operation
 */
async function downloadMissingGifs() {
  try {
    // Ensure the directory exists
    const directory = await ensureGifDirectory();
    
    // Counter variables
    let successCount = 0;
    let failedCount = 0;
    
    // Check each GIF and download if missing
    for (const [gifName, url] of Object.entries(FALLBACK_URLS)) {
      const gifPath = path.join(directory, gifName);
      
      // Check if file exists and is not empty
      const exists = fs.existsSync(gifPath) && fs.statSync(gifPath).size > 0;
      
      if (!exists) {
        console.log(`GIF ${gifName} is missing, downloading...`);
        const success = await downloadGif(gifName, url, directory);
        
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        console.log(`GIF ${gifName} already exists, skipping`);
      }
    }
    
    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error(`Error downloading missing GIFs: ${error.message}`);
    return { success: 0, failed: Object.keys(FALLBACK_URLS).length };
  }
}

/**
 * Check if a GIF exists in the local filesystem
 * @param {string} gifName Name of the GIF file
 * @returns {Promise<{exists: boolean, path: string|null}>} Check result
 */
async function checkGifExists(gifName) {
  try {
    const directory = await ensureGifDirectory();
    const gifPath = path.join(directory, gifName);
    
    const exists = fs.existsSync(gifPath) && fs.statSync(gifPath).size > 0;
    
    return {
      exists,
      path: exists ? gifPath : null
    };
  } catch (error) {
    console.error(`Error checking if GIF exists: ${error.message}`);
    return { exists: false, path: null };
  }
}

/**
 * Get the URL for a reaction GIF
 * @param {string} gifName Name of the GIF file
 * @returns {string|null} URL for the GIF or null if not found
 */
function getGifUrl(gifName) {
  return FALLBACK_URLS[gifName] || null;
}

/**
 * Initialize the fallback system by downloading missing GIFs
 * @returns {Promise<boolean>} Success status
 */
async function initializeFallbackSystem() {
  try {
    console.log('Initializing reaction GIFs fallback system');
    
    // Ensure the directory exists
    await ensureGifDirectory();
    
    // Download missing GIFs
    const result = await downloadMissingGifs();
    
    console.log(`Fallback system initialization complete. Downloaded ${result.success} GIFs, failed ${result.failed}.`);
    
    return result.failed === 0;
  } catch (error) {
    console.error(`Error initializing fallback system: ${error.message}`);
    return false;
  }
}

// Export functions
module.exports = {
  ensureGifDirectory,
  downloadGif,
  downloadMissingGifs,
  checkGifExists,
  getGifUrl,
  initializeFallbackSystem
};