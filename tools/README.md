# WhatsApp Bot Tools

This directory contains utility tools for maintaining code quality and ensuring consistency across the WhatsApp bot codebase.

## SafeSendMessage Validation Tools

These tools help ensure that all message sending is done safely using the `safeSendMessage` family of functions, which prevents "jid.endsWith is not a function" errors by properly validating JIDs before use.

### Available Tools

1. **fix-all-safesendmessage.js**
   - Scans all JS files in the project
   - Automatically fixes direct `sock.sendMessage` calls by replacing them with appropriate safe wrapper functions
   - Adds necessary imports where missing

   Usage:
   ```
   node tools/fix-all-safesendmessage.js
   ```

2. **validate-safesendmessage.js**
   - Validates that all modules are correctly using `safeSendMessage` and related functions
   - Checks for proper imports and usage
   - Reports detailed statistics on compliance

   Usage:
   ```
   node tools/validate-safesendmessage.js
   ```

3. **pre-commit-safesendmessage.js**
   - Git pre-commit hook that prevents committing code with unsafe message sending
   - Checks only files being committed
   - Provides clear instructions for fixing issues

   Setup as git hook:
   ```
   chmod +x tools/pre-commit-safesendmessage.js
   ln -s ../../tools/pre-commit-safesendmessage.js .git/hooks/pre-commit
   ```

## Why Safe Message Sending Is Important

Using `safeSendMessage` and related functions rather than direct `sock.sendMessage` calls is critical because:

1. It prevents the common "jid.endsWith is not a function" error by properly validating JIDs
2. It handles various JID formats and edge cases automatically
3. It provides consistent error handling and logging
4. It makes the code more robust against API changes in the WhatsApp library

## Best Practices

1. Always use the safe helper functions:
   - `safeSendMessage(sock, jid, content)` for general messages
   - `safeSendText(sock, jid, text)` for text messages
   - `safeSendImage(sock, jid, image, caption)` for images
   - `safeSendSticker(sock, jid, sticker, options)` for stickers
   - `safeSendAnimatedGif(sock, jid, gif, caption, options)` for GIFs

2. Always import these functions at the top of your file:
   ```javascript
   const { safeSendMessage, safeSendText, safeSendImage } = require('../utils/jidHelper');
   ```

3. Never use `sock.sendMessage` directly except in the `jidHelper.js` implementation file