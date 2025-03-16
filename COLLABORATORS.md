# Collaborating on BLACKSKY-MD WhatsApp Bot

This document provides information for collaborators on how to contribute to the BLACKSKY-MD WhatsApp bot project.

## Getting Access to Edit Files

There are several ways to contribute to this project:

### 1. Direct Repository Access

The repository owner can grant you direct access to edit files:

1. The repository owner needs to go to the repository settings on GitHub
2. Navigate to "Collaborators and teams" 
3. Click "Add people" or "Add teams"
4. Enter your GitHub username or email
5. Select the appropriate permission level:
   - **Read**: Can read and clone the repository, but cannot make changes
   - **Triage**: Can read, clone, and manage issues and pull requests, but cannot push changes
   - **Write**: Can read, clone, and push changes directly to the repository (recommended for active contributors)
   - **Maintain**: Similar to write access, but with additional administrative privileges
   - **Admin**: Full access to the repository, including sensitive settings (only for trusted collaborators)

### 2. Fork and Pull Request Workflow

If you don't have direct access, you can still contribute through pull requests:

1. Fork the repository to your own GitHub account
2. Clone your forked repository to your local machine
3. Create a new branch for your changes
4. Make your changes, commit them, and push to your fork
5. Create a pull request from your fork to the main repository
6. The repository owner will review and merge your changes if appropriate

### 3. GitHub Codespaces

For quick edits without setting up a local environment:

1. Open the repository on GitHub
2. Press the period key (`.`) to open GitHub's web-based editor
3. Make your changes directly in the browser
4. Commit your changes and create a pull request

## Using the GitHub Update Script

This repository includes a script to help with GitHub updates:

1. Make sure you have the necessary GitHub token
2. Run `node github-update.js` to push your changes
3. The script will automatically handle authentication and push your changes to the repository

## Best Practices for Collaboration

1. **Communication**: Discuss major changes before implementing them
2. **Documentation**: Document your code and update relevant documentation
3. **Testing**: Test your changes thoroughly before submitting
4. **Commits**: Write clear, descriptive commit messages
5. **Branches**: Create separate branches for different features or fixes
6. **Stay Updated**: Regularly pull changes from the main repository to stay up-to-date

## Setting Up Local Development Environment

1. Clone the repository: `git clone https://github.com/madariss5/BLACKSKY.git`
2. Install dependencies: `npm install`
3. Set up environment variables: Copy `.env.example` to `.env` and fill in required values
4. Start the bot using the quick-start script: `node quick-start.js`

## Getting Help

If you have questions or need help with the collaboration process, please reach out to the repository owner or other team members.

---

Thank you for contributing to the BLACKSKY-MD WhatsApp bot project!