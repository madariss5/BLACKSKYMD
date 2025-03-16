# Reaction GIF System Guide

This guide explains how to manage reaction GIFs in the WhatsApp bot. The reaction commands allow users to express emotions through animated GIFs, such as hugging, laughing, or waving.

## Overview

The bot includes 20 different reaction commands that send animated GIFs in response to user commands:

### Self-reactions (used when no target is mentioned)
- `!smile` - Displays a happy smiling animation
- `!happy` - Shows excitement animation
- `!dance` - Shows a dancing animation
- `!cry` - Displays a crying animation
- `!blush` - Shows a blushing animation
- `!laugh` - Displays a laughing animation

### Target-reactions (used when mentioning another user)
- `!hug @user` - Sends a hugging animation
- `!pat @user` - Shows a patting animation
- `!kiss @user` - Displays a kissing animation
- `!cuddle @user` - Shows a cuddling animation
- `!wave @user` - Displays a waving animation
- `!wink @user` - Shows a winking animation
- `!poke @user` - Pokes the mentioned user
- `!slap @user` - Displays a slapping animation
- `!bonk @user` - Shows a bonking animation
- `!bite @user` - Displays a biting animation
- `!punch @user` - Shows a punching animation
- `!highfive @user` - Gives a high five
- `!yeet @user` - Throws the mentioned user
- `!kill @user` - Shows an intense animation

## How It Works

The reaction system uses a direct GIF loading approach for reliability:

1. Source GIF files are stored in the `attached_assets/` directory
2. The system maps each command to its corresponding GIF file
3. When a reaction command is used, the bot loads the appropriate GIF directly
4. The GIF is sent as an animated sticker in the chat

## Troubleshooting Common Issues

### Issue: Reaction GIFs show the wrong animation

If reaction GIFs are showing incorrect animations (e.g., the hug command shows a slap), the system will automatically fix this during startup. The enhanced reaction fix ensures that all GIFs correctly match their commands through checksum verification.

### Issue: Reaction GIFs don't appear at all

If reaction GIFs don't appear:

1. Check that the `data/reaction_gifs/` directory exists
2. Ensure the bot has permission to read from the `attached_assets/` directory
3. Restart the bot to trigger the automatic GIF verification and mapping

## Testing Reaction GIFs

You can test if reaction GIFs are correctly mapped using the test script:

```
node src/test-reaction-gifs.js
```

This will show you:
- Which GIFs are correctly mapped
- Any missing or mismatched GIFs
- File sizes and checksum verification

## Advanced: Manual GIF Mapping

If you need to manually map a specific reaction to a different GIF:

1. Edit the `REACTION_GIF_MAPPING` in `src/commands/reactions.js`
2. Change the source filename for the desired command
3. Restart the bot to apply the changes

Example mapping:
```js
const REACTION_GIF_MAPPING = {
    'hug': 'tumblr_cdeb20431732069e4456c4ab66b9534f_8178dd55_500.gif',
    // other mappings...
};
```

## Adding New Reaction GIFs

To add a new reaction command:

1. Add the GIF file to the `attached_assets/` directory
2. Add the command and GIF filename to the `REACTION_GIF_MAPPING` in `src/commands/reactions.js`
3. Add the command handler function in the same file
4. Restart the bot to apply the changes

The system will automatically verify and set up the new reaction command.