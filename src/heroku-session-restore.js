/**
 * Heroku Session Restoration Script
 * This script handles the restoration of WhatsApp session credentials on Heroku
 * which has an ephemeral filesystem that doesn't persist between restarts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');
const CREDS_ENV_VAR = 'WHATSAPP_CREDS';
const AUTH_ENV_VAR = 'WHATSAPP_AUTH';

/**
 * Calculate a checksum for data verification
 * @param {string} data - Data to hash
 * @returns {string} - SHA-256 hash
 */
function calculateChecksum(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Initialize and restore session credentials from environment variables
 * @returns {Promise<Object|null>} Auth state object or null if not restored
 */
async function restoreSession() {
  try {
    console.log('Attempting to restore session from environment variables...');
    
    // Check if environment variables exist
    if (!process.env[CREDS_ENV_VAR] || !process.env[AUTH_ENV_VAR]) {
      console.log('No session credentials found in environment variables.');
      return null;
    }
    
    // Create auth directory if it doesn't exist
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    
    // Restore creds.json
    const credsData = Buffer.from(process.env[CREDS_ENV_VAR], 'base64').toString();
    fs.writeFileSync(path.join(AUTH_DIR, 'creds.json'), credsData);
    
    // Restore auth_info.json if it exists
    if (process.env[AUTH_ENV_VAR]) {
      const authData = Buffer.from(process.env[AUTH_ENV_VAR], 'base64').toString();
      fs.writeFileSync(path.join(AUTH_DIR, 'auth_info.json'), authData);
    }
    
    console.log('Session credentials restored successfully.');
    
    // Return the auth state in Baileys format
    return {
      state: {
        creds: JSON.parse(credsData),
        keys: {} // The keys will be loaded by Baileys from the file
      },
      saveCreds: async () => {
        const credsPath = path.join(AUTH_DIR, 'creds.json');
        const creds = JSON.parse(fs.readFileSync(credsPath));
        
        // Save to environment if in Heroku
        await saveSessionToEnv(creds);
        
        return creds;
      }
    };
  } catch (error) {
    console.error('Error restoring session:', error);
    return null;
  }
}

/**
 * Save session credentials to environment variables
 * @param {Object} creds - Credentials object 
 * @returns {Promise<boolean>} Whether saving was successful
 */
async function saveSessionToEnv(creds) {
  try {
    // Only proceed if we're on Heroku
    if (!process.env.HEROKU_APP_NAME) {
      return false;
    }
    
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    const authPath = path.join(AUTH_DIR, 'auth_info.json');
    
    // Read and encode creds.json
    const credsData = fs.readFileSync(credsPath).toString();
    const credsBase64 = Buffer.from(credsData).toString('base64');
    
    // Read and encode auth_info.json if it exists
    let authBase64 = '';
    if (fs.existsSync(authPath)) {
      const authData = fs.readFileSync(authPath).toString();
      authBase64 = Buffer.from(authData).toString('base64');
    }
    
    // Implement Heroku API call to update config vars
    // This would require the Heroku API token, which should be set as HEROKU_API_TOKEN
    if (process.env.HEROKU_API_TOKEN) {
      const fetch = require('node-fetch');
      const appName = process.env.HEROKU_APP_NAME;
      const url = `https://api.heroku.com/apps/${appName}/config-vars`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.heroku+json; version=3',
          'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
        },
        body: JSON.stringify({
          [CREDS_ENV_VAR]: credsBase64,
          [AUTH_ENV_VAR]: authBase64
        })
      });
      
      if (response.ok) {
        console.log('Session credentials saved to Heroku config vars.');
        return true;
      } else {
        console.error('Failed to save credentials to Heroku:', await response.text());
        return false;
      }
    } else {
      console.log('HEROKU_API_TOKEN not set, skipping automatic config var update.');
      console.log('To persist your session, set the following config vars in your Heroku dashboard:');
      console.log(`${CREDS_ENV_VAR}: ${credsBase64.substring(0, 20)}...`);
      console.log(`${AUTH_ENV_VAR}: ${authBase64.substring(0, 20)}...`);
      return false;
    }
  } catch (error) {
    console.error('Error saving session to environment:', error);
    return false;
  }
}

/**
 * Extract credentials from current session for backup
 * This can be called via a bot command to get credentials for env vars
 * @returns {Promise<Object>} Session credentials
 */
async function extractCredentials() {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    const authPath = path.join(AUTH_DIR, 'auth_info.json');
    
    // Read and encode creds.json
    if (!fs.existsSync(credsPath)) {
      throw new Error('creds.json not found');
    }
    const credsData = fs.readFileSync(credsPath).toString();
    const credsBase64 = Buffer.from(credsData).toString('base64');
    
    // Read and encode auth_info.json if it exists
    let authBase64 = '';
    if (fs.existsSync(authPath)) {
      const authData = fs.readFileSync(authPath).toString();
      authBase64 = Buffer.from(authData).toString('base64');
    }
    
    return {
      creds: credsBase64,
      auth: authBase64,
      checksumCreds: calculateChecksum(credsData),
      checksumAuth: authBase64 ? calculateChecksum(fs.readFileSync(authPath).toString()) : ''
    };
  } catch (error) {
    console.error('Error extracting credentials:', error);
    return null;
  }
}

/**
 * Convert auth_info.json to base64 for storage in environment variables
 * @returns {Promise<string|null>} Base64 encoded auth file or null if error
 */
async function getAuthFileBase64() {
  try {
    const authPath = path.join(AUTH_DIR, 'auth_info.json');
    if (!fs.existsSync(authPath)) {
      throw new Error('auth_info.json not found');
    }
    
    const authData = fs.readFileSync(authPath).toString();
    return Buffer.from(authData).toString('base64');
  } catch (error) {
    console.error('Error getting auth file base64:', error);
    return null;
  }
}

/**
 * Save session from an AuthState object (from Baileys)
 * @param {Object} authState - The auth state from Baileys
 * @returns {Promise<boolean>} Success status
 */
async function saveSession(authState) {
  try {
    if (!authState || !authState.state || !authState.state.creds) {
      console.error('Invalid auth state provided');
      return false;
    }
    
    // Create auth directory if it doesn't exist
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    
    // Save creds.json
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    fs.writeFileSync(credsPath, JSON.stringify(authState.state.creds, null, 2));
    
    // Call saveSessionToEnv to save to environment variables if on Heroku
    return await saveSessionToEnv(authState.state.creds);
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
}

// Export the session restorer utilities
exports.sessionRestorer = {
  restoreSession,
  saveSession,
  extractCredentials,
  getAuthFileBase64,
  saveSessionToEnv
};