# Bot Owner Configuration Guide

This guide explains how to properly configure the bot owner's phone number to ensure secure access to owner-level commands.

## Why Configure an Owner Number?

The owner number grants special privileges to control and administer your WhatsApp bot. The owner can:

- Execute sensitive system commands
- Add/remove features
- Control bot behaviors
- Manage groups via the bot
- Update configuration settings

Without a properly configured owner number, sensitive commands will be unavailable, or worse, available to unauthorized users.

## Setting Your Owner Number

There are two ways to set your owner number:

### 1. Using Environment Variables (Recommended)

For most secure deployment platforms (Replit, Heroku, etc), set the `OWNER_NUMBER` environment variable:

1. Find your WhatsApp phone number with country code
2. Remove any special characters (spaces, hyphens, parentheses, plus sign)
3. Set this in your `.env` file or hosting platform's environment variables

Example:
```
OWNER_NUMBER=12025550199
```

**Important**: Include your country code but DO NOT include any + signs, spaces, or other characters.

### 2. Using the Config File

You can also specify your owner number directly in `src/config/config.js`:

```javascript
owner: {
    number: '12025550199', // Replace with your number
    strictValidation: true
}
```

The environment variable will take priority if both are set.

## Verifying Your Owner Configuration

To verify your owner number is correctly configured:

1. Start your bot
2. Send a message to the bot with an owner-only command (such as `!restart` or `!shutdown`)
3. If the bot responds correctly, your owner number is properly set

If the owner commands don't work:
- Double-check your phone number format (no special characters, with country code)
- Ensure the number matches your current WhatsApp account
- Check if the environment variable is properly set
- Verify the config.js file has the correct information

## Security Considerations

- **Never share your .env file** or publicly expose your config with your owner number
- Use `strictValidation: true` in production to ensure exact number matching
- Regularly check logs for unauthorized access attempts
- Consider rotating your WhatsApp number if you suspect compromise

## Troubleshooting

If you're having issues with owner commands:

1. **Verify the number format**: Ensure you're using only digits with the country code (example: `12025550199`)
2. **Check for typos**: Any mistake in the number will prevent owner validation
3. **Confirm priority**: The environment variable overrides the config file setting
4. **Log validation**: In debug mode, enable `VERBOSE_LOGGING=true` to see permission checks
5. **Try full restart**: Sometimes a full bot restart is needed after changing the owner number

## Support

If you continue having issues setting your owner number, please:
- Check the documentation for any updates
- Search GitHub issues for similar problems
- Create a new issue with detailed information about your setup and the steps you've taken