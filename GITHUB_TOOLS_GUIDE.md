# GitHub Tools Guide

This guide provides instructions for using the special GitHub tools created to help you manage your repository when the web interface isn't working correctly.

## Available Tools

1. **github-permissions-fix.js**: Diagnoses and fixes permission issues with your GitHub repository
2. **github-file-editor.js**: Interactive tool for editing files directly without using the GitHub web interface
3. **github-browser-debug.js**: Diagnostic tool to identify browser-specific issues when editing on GitHub
4. **github-update.js**: Automated script to push your changes to GitHub

## Using the GitHub File Editor

The GitHub File Editor provides a simple terminal-based interface for editing your repository files without needing the GitHub web interface.

```bash
# Run the file editor
node github-file-editor.js
```

### Features:
- Browse repository files and directories
- View file contents
- Edit existing files
- Create new files
- Delete files

### When to use:
- When you can't edit files through the GitHub web interface
- When you need to make quick changes to your repository
- When you want to manage your repository from a terminal environment

## Using the GitHub Browser Debug Tool

This tool helps diagnose browser-specific issues that might prevent you from editing files on GitHub's web interface.

```bash
# Run the browser debug tool
node github-browser-debug.js
```

### Features:
- Checks GitHub service status
- Tests network connectivity and latency
- Analyzes system resources
- Verifies GitHub token validity
- Provides browser-specific troubleshooting steps

### When to use:
- When you're experiencing specific browser-related issues with GitHub
- Before contacting GitHub support for help
- To get browser-specific instructions for fixing common issues

## Using the GitHub Permissions Fix Tool

This tool verifies and fixes permission issues with your GitHub repository.

```bash
# Run the permissions fix tool
node github-permissions-fix.js
```

### Features:
- Verifies your GitHub token
- Checks your repository permissions
- Looks for collaborator issues
- Tests file creation and deletion
- Can add collaborators to your repository

### When to use:
- When you suspect permission issues are preventing edits
- When you want to add collaborators to your repository
- Before setting up automation that requires GitHub permissions

## Using the GitHub Update Script

This script helps you push changes to your GitHub repository easily.

```bash
# Run the update script
node github-update.js
```

### Features:
- Configures Git with your token authentication
- Adds modified files to Git
- Commits changes with a descriptive message
- Pushes changes to your repository

### When to use:
- After making changes you want to save to GitHub
- For regular updates to your repository
- When you want to simplify the Git workflow

## Troubleshooting

If you encounter issues with any of these tools:

1. **Token Issues**:
   - Ensure your GITHUB_TOKEN is correctly set in your .env file
   - Check that your token has the correct permissions (repo, workflow, etc.)
   - Generate a new token if your current one has expired

2. **Network Issues**:
   - Verify you have internet connectivity
   - Check if GitHub.com is accessible from your network
   - Try using a different network if possible

3. **Permission Errors**:
   - Use github-permissions-fix.js to diagnose specific permission problems
   - Ensure you're the owner or have admin permissions on the repository

4. **Script Errors**:
   - Make sure all dependencies are installed (`npm install`)
   - Check console output for specific error messages
   - Ensure you're running the scripts with Node.js

## Recommended Workflow

1. First, run `node github-permissions-fix.js` to verify permissions
2. If you're having browser issues, run `node github-browser-debug.js`
3. Use `node github-file-editor.js` to make changes to your files
4. Finally, run `node github-update.js` to push changes to GitHub

This workflow ensures you have the right permissions, identifies any browser issues, makes your changes safely, and pushes them to GitHub.

## Conclusion

These tools are designed to help you work with your GitHub repository even when the web interface isn't cooperating. By using these command-line alternatives, you can continue to manage and update your project without interruption.