/**
 * Heroku Integration Commands
 * Commands for managing Heroku deployment and session persistance
 */

const fs = require('fs');
const path = require('path');
const { isBotOwner } = require('../../utils/permissions');
const logger = require('../../utils/logger');

// Directory where auth files are stored
const AUTH_DIR = process.env.AUTH_DIR || 'auth_info_baileys';

/**
 * Extract credentials from current session for backup
 * @returns {Promise<Object>} Session credentials
 */
async function extractCredentials() {
  try {
    const credsPath = path.join(process.cwd(), AUTH_DIR, 'creds.json');
    
    if (!fs.existsSync(credsPath)) {
      logger.error('No creds.json file found. Please connect first.');
      return null;
    }
    
    // Read creds.json
    const credsData = fs.readFileSync(credsPath, 'utf8');
    const creds = JSON.parse(credsData);
    
    return {
      creds: creds,
      credsData: credsData
    };
  } catch (error) {
    logger.error(`Error extracting credentials: ${error.message}`);
    return null;
  }
}

/**
 * Convert auth_info.json to base64 for storage in environment variables
 * @returns {Promise<string|null>} Base64 encoded auth file or null if error
 */
async function getAuthFileBase64() {
  try {
    const authFilePath = path.join(process.cwd(), AUTH_DIR, 'auth_info.json');
    
    if (!fs.existsSync(authFilePath)) {
      logger.error('No auth_info.json file found.');
      return null;
    }
    
    // Read auth_info.json and convert to base64
    const authFileBuffer = fs.readFileSync(authFilePath);
    const base64Data = authFileBuffer.toString('base64');
    
    return base64Data;
  } catch (error) {
    logger.error(`Error converting auth file to base64: ${error.message}`);
    return null;
  }
}

module.exports = {
  category: 'admin',
  info: 'Commands for managing Heroku deployment',
  access: 'owner',
  commands: {
    /**
     * Get session credentials for Heroku deployment
     */
    getcreds: {
      desc: 'Extract session credentials for Heroku deployment',
      usage: '.getcreds',
      hidden: true,
      async handler(sock, msg, args) {
        // Check if sender is owner
        const sender = msg.key.remoteJid;
        const senderJID = msg.key.fromMe ? sock.user.id : sender;
        
        if (!await isBotOwner(senderJID)) {
          return await sock.sendMessage(sender, { text: '⛔ Only the bot owner can use this command.' });
        }
        
        await sock.sendMessage(sender, { text: '🔄 Extracting session credentials for Heroku...' });
        
        try {
          // Get credentials
          const credentials = await extractCredentials();
          if (!credentials) {
            return await sock.sendMessage(sender, { text: '❌ Failed to extract credentials. Make sure you are connected first.' });
          }
          
          // Send credentials
          await sock.sendMessage(sender, { 
            text: `✅ *CREDENTIALS FOR HEROKU*\n\nAdd these to your Heroku config vars:\n\nCREDS_DATA: ${JSON.stringify(credentials.creds)}`
          });
          
          // Get auth file as base64
          const authBase64 = await getAuthFileBase64();
          if (authBase64) {
            await sock.sendMessage(sender, {
              text: `✅ *AUTH FILE BASE64*\n\nThis is too large to display here. Save it securely and add to AUTH_FILE_BASE64 environment variable.`
            });
            
            // Send as document for larger content
            await sock.sendMessage(sender, {
              document: Buffer.from(authBase64),
              mimetype: 'text/plain',
              fileName: 'auth_file_base64.txt'
            });
          } else {
            await sock.sendMessage(sender, { text: '❌ Failed to generate AUTH_FILE_BASE64.' });
          }
          
          await sock.sendMessage(sender, { 
            text: `📝 *INSTRUCTIONS*\n\n1. Open your Heroku dashboard\n2. Go to Settings > Config Vars\n3. Add the CREDS_DATA and AUTH_FILE_BASE64 variables\n4. Restart your Heroku dyno`
          });
          
        } catch (error) {
          logger.error(`Error in getcreds command: ${error.stack}`);
          await sock.sendMessage(sender, { text: `❌ Error: ${error.message}` });
        }
      }
    },
    
    /**
     * Get Heroku deployment status
     */
    heroku: {
      desc: 'Check Heroku deployment status',
      usage: '.heroku',
      async handler(sock, msg, args) {
        const sender = msg.key.remoteJid;
        
        const isHeroku = process.env.PLATFORM === 'heroku' || process.env.DYNO;
        const herokuUrl = process.env.KEEP_ALIVE_URL;
        
        let status = '';
        if (isHeroku) {
          status += '✅ Running on Heroku\n';
          status += `📋 Dyno: ${process.env.DYNO || 'Unknown'}\n`;
          status += `🔄 Auto Restart: ${process.env.AUTO_RESTART === 'true' ? 'Enabled' : 'Disabled'}\n`;
          status += `🔄 Keep Alive URL: ${herokuUrl ? 'Configured' : 'Not configured'}\n`;
          
          // Check if credentials are stored in environment variables
          const hasCreds = !!process.env.CREDS_DATA;
          const hasAuthFile = !!process.env.AUTH_FILE_BASE64;
          
          status += `💾 Session Persistence: ${hasCreds && hasAuthFile ? 'Fully configured' : 
                    (hasCreds || hasAuthFile ? 'Partially configured' : 'Not configured')}\n`;
          
          if (!hasCreds || !hasAuthFile) {
            status += '\n⚠️ *Warning*: Session persistence is not fully configured.\n';
            status += 'Your bot may lose connection when Heroku restarts the dyno.\n';
            status += 'Use the `.getcreds` command to get session credentials.\n';
          }
        } else {
          status += '❌ Not running on Heroku\n';
          status += 'The bot is currently running in a different environment.\n';
        }
        
        await sock.sendMessage(sender, { text: `*Heroku Deployment Status*\n\n${status}` });
      }
    }
  }
};