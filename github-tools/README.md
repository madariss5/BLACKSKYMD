# BLACKSKY-MD GitHub Tools

This directory contains various utilities for working with GitHub directly from your WhatsApp bot environment. These tools enable file editing, repository management, and other GitHub operations without using the web interface.

## Available Tools

### Core Tools

1. **Minimal GitHub Editor** (`minimal-github-editor.js`)
   - Interactive web-based GitHub file editor
   - Browse repository contents, view and edit files
   - Create new files and verify token access

2. **Direct GitHub Editor** (`direct-github-editor.js`)
   - Command-line tool for non-interactive GitHub operations
   - Create, read, update, and delete files without prompts
   - Ideal for scripting or automation

3. **GitHub Token Test** (`test-github-token.js`)
   - Comprehensive permission test for GitHub tokens
   - Verifies read, write, update, and delete access
   - Detailed feedback on token capabilities

4. **Token Permission Fix** (`token-permission-fix.js`)
   - Diagnoses GitHub token permission issues
   - Provides step-by-step instructions for fixing token problems
   - Tests and validates token configuration

5. **GitHub Tools Launcher** (`launch.js`)
   - Central menu interface for accessing all GitHub tools
   - Simple selection of different GitHub utilities
   - User-friendly entry point for all GitHub operations

## Getting Started

1. Ensure your GitHub token is set in the environment:
   ```
   GITHUB_TOKEN=your_token_here
   ```

2. Run the launcher for an interactive menu:
   ```
   node github-tools/launch.js
   ```

3. Or run individual tools directly:
   ```
   node github-tools/test-github-token.js
   node github-tools/minimal-github-editor.js
   node github-tools/direct-github-editor.js [command] [args]
   ```

## Documentation

For detailed instructions on setting up and using these tools, see the 
`GITHUB_EDITING_GUIDE.md` file in this directory.

## Troubleshooting

If you encounter issues with GitHub token permissions:

1. Run `node github-tools/token-permission-fix.js` to diagnose the problem
2. Follow the instructions to generate a new token with proper permissions
3. Update your `GITHUB_TOKEN` environment variable with the new token
4. Test your configuration with `node github-tools/test-github-token.js`

## Security Notes

- Never share your GitHub token
- Don't commit your token to the repository 
- Set an expiration date for your token
- Use the minimum permissions necessary