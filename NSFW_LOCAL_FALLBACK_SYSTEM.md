# NSFW Command Content Handling

## Important Update

The NSFW command system has been fixed to use proper API-based content instead of mislabeled reaction GIFs.

### Previous implementation issues

Previously, the system was incorrectly using regular reaction GIFs as fallbacks for NSFW content. Specifically:

- Files in the `data/nsfw_fallbacks` directory were actually copies of reaction GIFs
- These files were mislabeled (e.g., `ass.gif` was actually a copy of `slap.gif`)
- This caused confusion and deceptive results when users requested NSFW content

### New implementation

The system now works in the following way:

1. Local fallback files are never used for NSFW content
2. All NSFW content is fetched from appropriate APIs including:
   - `api.nekos.fun/api`
   - `hmtai.hatsunia.cfd/v2/nsfw/`
   - `api.waifu.pics/nsfw/`

3. If the APIs fail, the system will inform the user that content is unavailable rather than showing misleading content

### Adding new NSFW commands

To add a new NSFW command:

1. Update the `src/utils/fetchNsfwImage.js` file
2. Add a new entry to the `CATEGORY_MAPPING` with appropriate API endpoints
3. Create a command handler in `src/commands/nsfw.js`

### API failure handling

If the API endpoints fail, the system will:

1. Attempt multiple API fallbacks when available
2. Notify users when content can't be retrieved
3. Never use mislabeled content as a substitute

## User age verification

The system continues to enforce age verification for NSFW content:

1. Users must verify their age with `.verify <age>`
2. Group administrators must enable NSFW commands with `.togglensfw on`
3. Commands are only available in specific contexts (not in public groups)