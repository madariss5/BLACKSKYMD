# Running BLACKSKY-MD on Replit

This guide provides step-by-step instructions for setting up and running BLACKSKY-MD WhatsApp bot on Replit, a cloud-based development platform.

## Getting Started

### 1. Fork the Repl

1. Click the "Fork" button to create your own copy of this Repl
2. Give your Repl a name (e.g., "my-whatsapp-bot")
3. Wait for the Repl to initialize

### 2. Set Up Environment Variables

1. In your Repl, click on the "Secrets" (lock icon) in the Tools section
2. Add any required environment variables (if needed):
   - `GITHUB_TOKEN`: Your GitHub personal access token (required for GitHub updates)
   - Other API keys as needed for specific features

### 3. Start the Bot

You have multiple ways to start the bot:

#### Option 1: Quick Start Script (Recommended)
1. Run `node quick-start.js` in the Replit Shell
2. Select your preferred connection method from the menu
3. Follow the on-screen instructions to scan the QR code

#### Option 2: Direct Connection
1. Run `node src/qr-web-server.js` in the Replit Shell
2. A QR code will be displayed in the Webview (or visit the URL provided)
3. Scan the QR code with your WhatsApp

## Keeping the Bot Online 24/7

Replit Free tier will shut down your Repl after a period of inactivity. To keep your bot running:

1. Enable "Always On" feature (available with Replit Pro subscription)
2. If you don't have Pro, set up a ping service like UptimeRobot to periodically ping your Repl's URL

## Sharing Access with Others

You can easily share your WhatsApp bot with others on Replit:

### Method 1: Sharing your Repl
1. Click the "Share" button in the top-right corner
2. Set the appropriate privacy setting:
   - **Public**: Anyone can view and fork your code (not recommended if you have sensitive information)
   - **Private** (Replit Pro feature): Only people you invite can access
3. Copy the share link and send it to your collaborators

### Method 2: Multiple Editors
1. Click the "Share" button in the top-right corner
2. In the "Invite" section, enter the username or email of your collaborator
3. Set their permission level (Read, Write, or Admin)
4. Click "Invite"

## Replit-Specific Limitations and Solutions

### Connection Issues
If you're having trouble connecting to WhatsApp:
1. Try the "Enhanced Connection" method (`node enhanced-connection.js`)
2. If that fails, try "Firefox Connection" or "Safari Connection" methods
3. For slow networks, use the Terminal QR method (`node src/terminal-qr.js`)

### Memory Limitations
Replit Free tier has memory limitations. To optimize:
1. Avoid running resource-intensive features simultaneously
2. Use the built-in cleanup commands periodically: `node cleanup.sh`
3. Restart your Repl if you notice it becoming sluggish

### GitHub Integration
To keep your GitHub repository in sync with your Repl:
1. Set the `GITHUB_TOKEN` environment variable
2. Run `node github-update.js` whenever you want to push changes

## Troubleshooting

### QR Code Not Displaying
1. Check the Webview tab or visit the URL provided in the console
2. Try a different connection method from the quick-start script
3. If all else fails, use the Terminal QR method

### Bot Disconnects Frequently
1. Make sure your Repl stays active using the "Always On" feature or a ping service
2. Use the credential backup feature to quickly restore connections
3. Try different connection methods to find the most stable one for your network

### Other Issues
If you encounter any other issues, check the following:
1. Console logs for error messages
2. Network connectivity (Replit sometimes has outages)
3. WhatsApp service status

## Additional Resources

- [Official Replit Documentation](https://docs.replit.com/)
- [WhatsApp Multi-Device API Documentation](https://wwebjs.dev/guide/)
- [Baileys Documentation](https://whiskeysockets.github.io/Baileys/)

---

For more detailed information on the bot's features and commands, refer to the main README.md file.