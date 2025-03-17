# Reaction GIF Matching Guide

This guide explains how the BLACKSKY-MD WhatsApp bot handles reaction GIFs, particularly in cloud environments where local file access may be limited.

## Understanding Reaction GIFs

Reaction GIFs are animated images used to express emotions or actions in response to messages. BLACKSKY-MD includes commands like `!hug`, `!slap`, `!dance`, etc., that send these animations.

## Challenges in Cloud Environments

When deploying to cloud platforms like Heroku, several challenges arise:

1. **Ephemeral Filesystem**: Files uploaded to Heroku are lost when the dyno restarts
2. **Size Limitations**: Heroku has a 500MB slug size limit, making it difficult to include large GIF files
3. **Performance**: Storing and processing large GIFs can impact bot performance

## The Multi-Layer Fallback System

BLACKSKY-MD solves these issues with a sophisticated multi-layer fallback system:

### Layer 1: Local GIF Files

The bot first checks for GIF files in the `data/reaction_gifs` directory:

```
data/reaction_gifs/
├── hug.gif
├── slap.gif
├── dance.gif
...
```

These files work perfectly on local deployments or persistent storage environments.

### Layer 2: Network-Based Fallback

If local files aren't available or accessible, the bot automatically fetches GIFs from reliable public sources:

```javascript
// Example mapping in reaction-gifs-fallback.js
const FALLBACK_URLS = {
  'hug': 'https://cdn.example.com/reaction-gifs/hug.gif',
  'slap': 'https://cdn.example.com/reaction-gifs/slap.gif',
  // ...more mappings
};
```

The system uses content delivery networks (CDNs) for fast, reliable delivery.

### Layer 3: Dynamic Search

If both local and predefined network sources fail, the system can optionally search public GIF APIs:

```javascript
// Pseudocode for dynamic fallback
async function findReactionGif(category) {
  // Try local file
  // Try network fallback
  // As last resort, search API
  const result = await searchGifAPI(category + " anime reaction");
  return result.url;
}
```

## How to Add New Reaction GIFs

### Adding Local GIFs

1. Find or create an appropriate anime-style GIF
2. Ensure the file is optimized (ideally under 2MB)
3. Name it according to the command (e.g., `dance.gif` for the `!dance` command)
4. Place it in the `data/reaction_gifs/` directory

### Adding Fallback URLs

Edit the `src/reaction-gifs-fallback.js` file:

```javascript
// Add your new reaction with a reliable CDN-hosted URL
{
  'newreaction': 'https://cdn.example.com/reaction-gifs/newreaction.gif'
}
```

### Creating a New Reaction Command

1. Add the GIF file and fallback URL as described above
2. Add the command to `commands/reactions.js`:

```javascript
newreaction: {
  handler: async (sock, msg, args) => {
    const targetUser = msg.mentioned[0] || msg.quoted?.participant || null;
    const sender = msg.sender;
    
    await sendReactionGif(sock, msg.from, 'newreaction', {
      sender, 
      target: targetUser,
      caption: `@${msg.sender.split('@')[0]} does a new reaction ${targetUser ? `to @${targetUser.split('@')[0]}` : ''}`
    });
  },
  help: 'Send a new reaction GIF',
  group: true,
  nsfw: false
}
```

## Verifying GIF Mappings

You can verify that your GIFs are correctly mapped by running:

```bash
node src/verify-reaction-gifs.js
```

This will show a report of all reaction GIFs, their file sizes, and availability status.

## How the Fallback System Works

When a reaction command is triggered, the system:

1. First checks if the local GIF exists using `fs.existsSync()`
2. If not found, checks if a fallback URL is defined for this reaction
3. Downloads the GIF from the fallback URL and caches it temporarily
4. Sends the GIF to the WhatsApp chat
5. Optionally saves the downloaded GIF to the local filesystem if writable

This process happens automatically and transparently to the user.

## Troubleshooting Reaction GIFs

### GIFs Not Sending

1. Verify the local GIF exists: `ls -la data/reaction_gifs/`
2. Check the fallback URL is accessible
3. Ensure the GIF is a supported format and not corrupted
4. Look at the logs for any error messages

### Optimizing GIFs for Performance

Large GIFs can cause performance issues. Consider:

1. Using the `gifsicle` tool to optimize: `gifsicle -O3 input.gif > output.gif`
2. Reducing the resolution or frame count
3. Converting to WebP format for better compression

## Best Practices

1. **Use CDN-hosted fallbacks** for reliability and speed
2. **Keep GIFs under 2MB** for optimal performance
3. **Verify new GIFs** work in both local and cloud environments
4. **Maintain consistent naming** between files, fallbacks, and commands

By following this guide, your reaction GIFs will work reliably in all environments, including cloud platforms with ephemeral filesystems.