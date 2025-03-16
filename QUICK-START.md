# BLACKSKY-MD Quick Start Guide

This guide provides a fast way to get your WhatsApp bot up and running.

## 1. Getting Started

Choose one of these methods to start the bot:

### Option A: Easy Menu (Recommended)

Run the start script to see all available connection options:

```bash
./start-whatsapp.sh
```

### Option B: Direct Commands

Start with the Advanced Connection Manager (recommended for cloud environments):
```bash
node connection-manager.js
```

OR

Use the simple Terminal QR Code method:
```bash
node terminal-qr-connect.js
```

## 2. Scan the QR Code

When the QR code appears:

1. Open WhatsApp on your phone
2. Tap Menu (⋮) or Settings > Linked Devices
3. Tap "Link a Device"
4. Scan the QR code displayed in your terminal or browser
5. Wait for the connection to be established

## 3. Test Your Connection

Once connected, send these test commands to your bot:

- `!ping` - Should respond with "Pong! 🏓"
- `!help` - Shows available commands
- `!info` - Displays bot information

## 4. Troubleshooting

If you encounter connection issues:

1. Run the cleanup script to reset the connection:
   ```bash
   ./cleanup-connections.sh
   ```
   
2. Select option 2 for a full reset

3. Try connecting again with:
   ```bash
   ./start-whatsapp.sh
   ```

## 5. Command Structure

- All commands start with the prefix `!` by default
- Basic syntax: `!command argument1 argument2`
- Example: `!help ping` to get help for the ping command

## 6. Common Commands

### Basic Commands
- `!ping` - Check if the bot is online
- `!help` - Show command list
- `!info` - Display bot information
- `!menu` - Show command categories

### Group Management
- `!kick @user` - Remove a user from a group
- `!add 123456789` - Add a user to a group
- `!promote @user` - Make a user admin
- `!demote @user` - Remove admin status

### Media Commands
- `!sticker` - Convert image to sticker
- `!gif` - Convert video to animated sticker

## 7. For More Help

- Connection issues: See `CONNECTION_README.md`
- Run 24/7: See `RUNNING_24_7_GUIDE.md`
- Environment guides: See `HEROKU.md` or `TERMUX_GUIDE.md`

---

For detailed information about all commands and features, send `!help` to the bot after connecting.