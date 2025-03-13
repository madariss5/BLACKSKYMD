# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-03-13

### Added
- Unified WhatsApp Bot with integrated QR display and bot functionality
- Web-based QR code display system on port 5000
- Credentials backup to the bot's own chat instead of owner
- Auto reconnection with exponential backoff
- Improved error handling for better connection stability
- Multi-language support with English and German translations
- German instructions in the QR web interface
- Session backup scheduler that maintains rotating backups
- Status indicators in web interface showing connection state

### Changed
- Authentication data now only clears on DisconnectReason.loggedOut
- Simplified session management to prevent conflicts
- Unified all bot functionality into a single script (connected-bot.js)
- Enhanced logging with better categorization and clarity
- Improved QR code display with automatic refresh

### Fixed
- Fixed issue with multiple conflicting sessions
- Resolved authentication data being cleared unnecessarily
- Fixed session conflicts between QR generators and bot
- Improved error handling for better recovery from network issues
- Better handling of connection termination and reconnects