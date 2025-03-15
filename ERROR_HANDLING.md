# WhatsApp Bot Error Handling System

This document describes the comprehensive error handling system implemented in the BLACKSKY-MD WhatsApp bot.

## Overview

The bot features a sophisticated error handling system with the following key components:

1. **Specialized Error Handlers**: Custom handlers for different types of errors (connection, API, media, etc.)
2. **Retry Logic with Exponential Backoff**: Automatic retries with increasing delays to handle transient failures
3. **Error Categorization**: Detailed error classification for better diagnostics and user feedback
4. **User-Friendly Error Messages**: Informative feedback based on error types
5. **Graceful Degradation**: Fallback mechanisms when primary functionality fails
6. **Centralized Error Logging**: Structured logging of all errors for better debugging

## Architecture

### 1. Connection Error Handler

Located in `src/utils/connectionErrorHandler.js`, this utility specializes in handling WhatsApp connection issues:

- Categorizes connection errors (authentication, network, rate limiting)
- Implements appropriate recovery strategies for each error type
- Tracks statistics on connection stability
- Performs auto-reconnection with exponential backoff

### 2. Command Error Handler

Located in `src/utils/errorHandler.js`, this module provides standardized error handling for all command modules:

- Wraps command functions with error handling
- Provides informative error messages to users
- Logs detailed error information for debugging
- Retries failed operations when appropriate

### 3. API Request Error Handling

The API request system features enhanced error handling for external service calls:

- Implements exponential backoff for API requests
- Provides multiple fallback endpoints for critical services
- Validates API responses before processing
- Handles rate limiting gracefully

Example implementation in the NSFW module:

```javascript
async function fetchWithExponentialBackoff(url, options = {}, retries = 3, initialDelay = 500) {
    let delay = initialDelay;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                ...options
            });
            return response.data;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            
            logger.warn(`API fetch attempt ${attempt + 1}/${retries} failed: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}
```

### 4. Media Handling Error Recovery

Media processing functions include enhanced error handling:

- Validates media types before processing
- Implements multiple fallback methods for sending media
- Provides appropriate error messages for media-related failures
- Handles memory constraints and file system errors

Example from the NSFW GIF sending function:

```javascript
async function sendNsfwGif(sock, sender, url, caption) {
    let retries = 2;
    let delay = 1000;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Download and send media with validation
            // ...
        } catch (err) {
            if (attempt === retries) {
                // Final fallback to text message
                await safeSendText(sock, sender, `${caption}\n\n(GIF failed to send)`);
                return false;
            }
            
            logger.warn(`Attempt ${attempt+1}/${retries+1} failed: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}
```

### 5. Safe Message Sending Functions

Located in `src/utils/jidHelper.js`, these functions ensure reliable message delivery:

- Validate JID format before sending messages
- Handle errors specific to different message types
- Provide fallback mechanisms for failed sends
- Normalize JIDs to prevent "jid.endsWith is not a function" errors

### 6. Enhanced Error User Interface

The system provides an improved user experience with interactive error messages:

- Uses buttons for common error recovery actions
- Provides "Try Again" option for transient errors
- Includes "Get Help" button for persistent issues
- Falls back to plain text when buttons aren't supported

Example implementation:

```javascript
// Create a wrapper function that adapts safeSendButtons to the signature expected by retryMessageSend
const buttonSendWrapper = async (sock, jid, content) => {
  if (!content || typeof content !== 'object') return null;
  return await safeSendButtons(
    sock, 
    jid, 
    content.text || '', 
    content.footer || '', 
    content.buttons || []
  );
};

const result = await retryMessageSend(
  sock,
  normalizedJid,
  {
    text: errorMessage,
    footer: `Error Category: ${category.toUpperCase()}`,
    buttons: [
      {buttonId: 'help', buttonText: {displayText: '💡 Get Help'}, type: 1},
      {buttonId: `${commandName}_retry`, buttonText: {displayText: '🔄 Try Again'}, type: 1}
    ]
  },
  { maxRetries: 2, sendFunction: buttonSendWrapper }
);
```

## Error Categories

The system categorizes errors into the following types:

1. **Connection Errors**: Issues with the WhatsApp connection
2. **API Errors**: Problems with external service calls
3. **Media Errors**: Failures in media processing or sending
4. **User Input Errors**: Invalid user inputs or commands
5. **Permission Errors**: Insufficient permissions for actions
6. **System Errors**: Internal failures in the bot system

## Best Practices

When implementing new features, follow these error handling best practices:

1. **Use Safe Functions**: Always use the safe message sending functions
2. **Implement Retries**: Use exponential backoff for network operations
3. **Provide Fallbacks**: Include fallback mechanisms for critical features
4. **Log Detailed Errors**: Include context information in error logs
5. **Give Helpful Feedback**: Provide clear error messages to users
6. **Validate Inputs**: Check all inputs before processing
7. **Handle All Promises**: Use try/catch for all async operations
8. **Use Adapters for Mismatched Interfaces**: Create wrapper functions when function signatures don't match
9. **Apply Good Testing**: Test error handling with realistic failure scenarios

## Testing Error Handling

The repository includes specific test scripts for verifying error handling:

- `test-error-recovery.js`: Tests the error recovery capabilities
- `test-nsfw-commands.js`: Tests specific command error handling
- `test-jid-helper.js`: Tests JID validation and message sending

## Future Improvements

Planned enhancements to the error handling system:

1. Implement adaptive retry strategies based on error patterns
2. Add error analytics to identify common failure points
3. Develop automated recovery for more error scenarios
4. Enhance user notification for persistent errors
5. Implement circuit breaker pattern for external services

## Conclusion

The comprehensive error handling system ensures the WhatsApp bot operates reliably even in challenging conditions, providing a smooth user experience and making the system more maintainable and robust.