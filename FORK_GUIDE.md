# Repository Forking Guide

This guide will help you create and maintain your own personal fork of the BLACKSKY-MD WhatsApp bot. Forking allows you to create your own copy of the repository where you can make changes without affecting the original project.

## What is a Fork?

A fork is a copy of a repository that allows you to freely experiment with changes without affecting the original project. Forks are commonly used to:

1. Propose changes to someone else's project
2. Use someone else's project as a starting point for your own idea
3. Create a personal copy with your own customizations

## Benefits of Forking BLACKSKY-MD

- Create your own personalized version of the bot
- Add custom commands and features
- Maintain your own development path
- Keep up with updates from the original repository when needed
- Contribute improvements back to the original project (optional)

## How to Fork BLACKSKY-MD

### Step 1: Create a GitHub Account

If you don't already have one, you'll need to create a GitHub account at [github.com](https://github.com/).

### Step 2: Fork the Repository

1. Go to the BLACKSKY-MD repository: [https://github.com/madariss5/BLACKSKY](https://github.com/madariss5/BLACKSKY)
2. Click the "Fork" button in the top-right corner of the page
3. GitHub will create a copy of the repository under your account

### Step 3: Clone Your Fork

After forking, you'll want to get a local copy of your fork. You can do this by cloning the repository:

```bash
git clone https://github.com/YOUR-USERNAME/BLACKSKY.git
cd BLACKSKY
```

Replace `YOUR-USERNAME` with your actual GitHub username.

### Step 4: Keep Your Fork Up to Date (Optional)

To keep your fork updated with the original repository:

1. Add the original repository as a remote:

```bash
git remote add upstream https://github.com/madariss5/BLACKSKY.git
```

2. Fetch changes from the original repository:

```bash
git fetch upstream
```

3. Merge changes from the original repository into your fork:

```bash
git checkout main
git merge upstream/main
```

## Deploying Your Forked Bot

### Option 1: Deploy on Replit

1. Create a Replit account at [replit.com](https://replit.com/) if you don't have one
2. Click the "+" button to create a new Repl
3. Choose "Import from GitHub"
4. Enter the URL of your forked repository (https://github.com/YOUR-USERNAME/BLACKSKY)
5. Click "Import from GitHub"
6. Once imported, click the "Run" button to start the bot
7. Scan the QR code from your WhatsApp to link your device

### Option 2: Deploy on Heroku

1. Create a [Heroku](https://heroku.com) account if you don't have one
2. Create a new app from your Heroku dashboard
3. In the "Deploy" tab, choose "GitHub" as the deployment method
4. Connect your GitHub account and select your forked repository
5. Click "Deploy Branch"
6. Check the logs in the Heroku dashboard to find the QR code

## Making Customizations

Now that you have your own fork, you can customize the bot to your liking:

### Adding Custom Commands

1. Navigate to the `src/commands` directory
2. Create a new file for your commands or modify an existing one
3. Follow the command format shown in the example files
4. Add your custom logic and features

### Changing Bot Settings

1. Edit the `.env` file to modify basic bot settings
2. For more advanced settings, explore the `src/config` directory

### Adding Custom Features

1. Create new modules in the appropriate directories
2. Update the main files to include your new modules
3. Test your changes thoroughly

## Using GitHub Tools

Your forked repository includes several GitHub tools to help you manage your fork:

1. **Fork Helper Utility**: Located in the `github-tools` directory, this tool helps you track your fork and manage its relationship with the original repository.

2. **GitHub Editor**: Also in the `github-tools` directory, this tool allows you to edit files directly from your terminal, without needing to use the GitHub web interface.

To use these tools:

```bash
cd github-tools
chmod +x launch-github-tools.sh
./launch-github-tools.sh
```

## Contributing Back (Optional)

If you've made improvements that you think would benefit the original project:

1. Push your changes to your forked repository
2. Go to your fork on GitHub and click "Pull Request"
3. Choose to create a pull request to the original repository
4. Describe your changes and submit the pull request

## Need Help?

If you encounter any issues with your fork, feel free to:

1. Create an issue in the original repository
2. Reach out to the community for help
3. Check the documentation for troubleshooting tips

Happy coding with your personal fork of BLACKSKY-MD!