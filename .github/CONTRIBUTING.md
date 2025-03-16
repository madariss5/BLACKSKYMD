# Contributing to BLACKSKY-MD WhatsApp Bot

Thank you for your interest in contributing to the BLACKSKY-MD WhatsApp Bot project! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with the following information:
- Clear description of the bug
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, Node.js version, etc.)

### Suggesting Features

Feature requests are welcome! Please create an issue with:
- Clear description of the feature
- Why this feature would be beneficial
- Any implementation ideas you have

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Submit a pull request

Please use the PR template provided when creating your pull request.

## Development Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Install system dependencies (for canvas/chart.js functionality)
   ```bash
   # For Ubuntu/Debian
   sudo apt-get install libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
   
   # For macOS with Homebrew
   brew install cairo pango jpeg giflib
   ```

4. Start the bot for local development
   ```bash
   node quick-connect.js
   ```

## Code Style

- Use 2 spaces for indentation
- Use camelCase for variables and functions
- Use PascalCase for classes
- Use meaningful variable and function names
- Comment your code where necessary

## Testing

Before submitting a PR, please test your changes:
- Ensure the bot connects successfully
- Test any commands you've modified or added
- Check that your changes work in different environments if possible

## Deployment Contributions

When making changes that affect deployment:
1. Update relevant documentation
2. Test on local environment first
3. If possible, test on the target platform (e.g., Heroku)
4. Update the deployment guides if necessary

## Documentation

If you're adding or changing features, please update the relevant documentation. Clear documentation helps everyone use the project effectively.

## Questions?

If you have any questions about contributing, feel free to open an issue asking for clarification.

Thank you for contributing to BLACKSKY-MD WhatsApp Bot!