# GitHub Direct Editing Guide

This guide provides detailed instructions for setting up and using the direct GitHub file editing capabilities of the BLACKSKY-MD WhatsApp bot.

## Prerequisites

Before you can edit GitHub files directly, you need:

1. A GitHub account
2. A Personal Access Token with proper permissions
3. The BLACKSKY-MD repository (either as owner or with write access)

## Setting Up Your GitHub Token

To create a GitHub token with proper permissions:

1. Go to [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token" > "Generate new token (classic)"
3. Fill in the following:
   - **Note**: WhatsApp Bot GitHub Access
   - **Expiration**: Select an appropriate expiration (90 days recommended)
4. Select the following permissions:
   - **repo** (Full control of private repositories)
5. Click "Generate token" at the bottom
6. **IMPORTANT**: Copy your token immediately, as you won't be able to see it again!

## Adding Your Token to the Bot

1. In your Replit environment, go to the Secrets panel (lock icon)
2. Add a new secret:
   - **Key**: `GITHUB_TOKEN`
   - **Value**: Your GitHub token

## Using the GitHub Editor Tools

We provide several tools to help you edit files directly on GitHub:

### Simple Web-Based Editor

The web-based GitHub Editor provides an interactive interface for browsing and editing your repository:

1. Start the editor workflow (it automatically uses your GitHub token)
2. Choose from the menu options:
   - Browse repository
   - Edit a file
   - Create a new file
   - Verify GitHub token

### Command-Line Direct Editor

For non-interactive editing, use our direct editor script:

```bash
# List files in the repository
node github-tools/direct-github-editor.js list

# View a file
node github-tools/direct-github-editor.js view README.md

# Create a new file
node github-tools/direct-github-editor.js create test.md "# Test File" "Create test file"

# Update an existing file
node github-tools/direct-github-editor.js update README.md "# Updated README" "Update README"

# Delete a file
node github-tools/direct-github-editor.js delete test.md "Remove test file"
```

### Checking Token Permissions

If you're having trouble editing files, check your token permissions:

```bash
node github-tools/token-permission-fix.js
```

This script will:
1. Verify if your token is valid
2. Check if it has write permissions
3. Provide instructions to fix any permission issues

## Troubleshooting

### Common Issues

1. **"Not authorized" or 401 errors**
   - Your token may be invalid or expired
   - Generate a new token following the instructions above

2. **"Not found" or 404 errors**
   - Ensure you're using the correct repository name
   - Check if the file path is correct

3. **"You don't have permission" or 403 errors**
   - Your token may not have sufficient permissions
   - Ensure your token has the "repo" scope
   - Check if you have write access to the repository

4. **Editor crashes or hangs**
   - Try using the direct-github-editor.js tool instead

## Best Practices

1. Make targeted, specific changes
2. Write clear commit messages
3. Don't include sensitive information in commits
4. Test your changes after pushing them

## Security Notes

- Never share your GitHub token
- Don't commit your token to the repository
- Set an expiration date for your token
- Use the minimum permissions necessary