# Cloud Environment Guide for BLACKSKY-MD

This guide provides essential information for maintaining a stable WhatsApp connection when hosting BLACKSKY-MD in cloud environments like Heroku, AWS, or Google Cloud.

## Understanding Cloud Challenges

Cloud environments present unique challenges for WhatsApp bots:

1. **Ephemeral Filesystem**: Many cloud platforms use non-persistent file storage that resets when services restart
2. **Periodic Restarts**: Services like Heroku restart dynos every 24 hours
3. **Connection Stability**: Maintaining websocket connections requires proper management
4. **Resource Constraints**: Free tiers have limited memory and processing power

BLACKSKY-MD is designed with these challenges in mind and includes special features to ensure 24/7 uptime.

## Session Persistence Systems

### 1. Automatic Backup and Restore

The bot includes a sophisticated session management system that:

- Creates regular backups of the WhatsApp session credentials
- Automatically restores these credentials after restarts
- Implements checksums to verify data integrity
- Uses a rotating backup system to prevent corruption

### 2. Environment Variable Storage (Heroku)

On Heroku, the bot can store critical session data in environment variables:

```javascript
// Session data is automatically stored in these environment variables
process.env.WA_AUTH_STATE
process.env.WA_CREDENTIALS
process.env.WA_SESSION_DATA
```

This ensures persistence across dyno restarts without requiring database add-ons.

## Optimizing for Reliability

### Memory Management

Cloud environments often have memory constraints. BLACKSKY-MD includes:

- Efficient media handling that doesn't store large files in memory
- Automatic garbage collection for temporary files
- Resource monitoring to prevent crashes
- Progressive loading of large command modules

### Connection Monitoring

The bot includes a robust connection monitoring system:

- Automatic reconnection when connection drops
- Heart-beat checks to verify connection status
- Graceful handling of WhatsApp server disconnections
- Detailed logging for troubleshooting

## Reaction GIFs in the Cloud

While traditional WhatsApp bots struggle with media in cloud environments, BLACKSKY-MD includes:

- A network-based fallback system for reaction GIFs
- Content delivery network (CDN) integration for faster media delivery
- Progressive loading of media files
- Optimized media processing for reduced memory usage

## Advanced Configuration Options

### Custom Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CLOUD_MODE` | Enable cloud-specific optimizations | `true` |
| `SESSION_BACKUP_INTERVAL` | Minutes between session backups | `15` |
| `MAX_RECONNECT_ATTEMPTS` | Max reconnection attempts before QR refresh | `5` |
| `MEMORY_LIMIT_MB` | Memory usage limit for auto-optimization | `512` |
| `USE_CDN_MEDIA` | Use CDN for media delivery | `true` |

### Managing Periodic Restarts

For platforms with forced restarts (like Heroku's 24-hour cycle):

1. **Schedule optimal restart times** during low-usage periods
2. **Implement graceful shutdowns** to complete pending operations
3. **Use connection webhooks** to monitor status remotely

```bash
# Heroku example: Schedule restart at 3am UTC
heroku dyno:restart --app your-app-name --at="03:00 UTC"
```

## Monitoring and Troubleshooting

### Logs Access

Access logs to diagnose connection issues:

```bash
# Heroku example
heroku logs --tail --app your-app-name

# AWS example
aws logs get-log-events --log-group-name /aws/lambda/your-function
```

### Connection Statistics

The bot provides detailed connection statistics at the `/stats` endpoint, showing:

- Connection uptime
- Message processing rate
- Memory usage trends
- Reconnection events

## Best Practices for 24/7 Uptime

1. **Use a paid tier** on your cloud platform for best reliability
2. **Implement external monitoring** with services like UptimeRobot
3. **Set up automatic alerts** for connection failures
4. **Use a secondary bot instance** as a fallback
5. **Regularly update your WhatsApp app** on the connected phone

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Frequent disconnections | Check network stability, increase reconnect attempts |
| Memory leaks | Update to latest version, reduce concurrent operations |
| Session corruption | Enable checksums, increase backup frequency |
| Slow media delivery | Enable CDN, optimize media size, use progressive loading |

## Need Advanced Support?

For custom cloud deployment assistance, please open an issue on our [GitHub repository](https://github.com/madariss5/BLACKSKYMD/issues) with details about your cloud environment and specific challenges.