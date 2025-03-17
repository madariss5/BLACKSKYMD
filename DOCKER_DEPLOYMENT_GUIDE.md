# Docker Deployment Guide for BLACKSKY-MD

This guide will help you deploy BLACKSKY-MD WhatsApp bot using Docker, which provides excellent isolation, consistency, and portability.

## Prerequisites

- Docker installed on your system
  - [Install Docker on Windows](https://docs.docker.com/desktop/install/windows-install/)
  - [Install Docker on macOS](https://docs.docker.com/desktop/install/mac-install/)
  - [Install Docker on Linux](https://docs.docker.com/engine/install/)
- Basic knowledge of terminal/command line

## Quick Start Deployment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/madariss5/BLACKSKYMD.git
   cd BLACKSKYMD
   ```

2. **Build the Docker image**:
   ```bash
   docker build -t blackskymd .
   ```

3. **Run the container**:
   ```bash
   docker run -d -p 5000:5000 \
     -e OWNER_NUMBER=your-number-here \
     --name blackskymd-bot \
     blackskymd
   ```

4. **Access the QR code**:
   Open your browser and navigate to `http://localhost:5000/qr`

5. **Scan the QR code** with your WhatsApp to connect your bot.

## Using Docker Compose (Recommended)

For easier management, you can use Docker Compose:

1. **Create a `docker-compose.yml` file**:
   ```yaml
   version: '3'
   
   services:
     blackskymd:
       build: .
       ports:
         - "5000:5000"
       environment:
         - OWNER_NUMBER=your-number-here
         - PREFIX=!
         - DISABLE_PM=false
         - ENABLE_NSFW=false
       volumes:
         - ./auth_data:/usr/src/app/auth_info_baileys
       restart: unless-stopped
   ```

2. **Start the service**:
   ```bash
   docker-compose up -d
   ```

3. **Access the QR code**:
   Open your browser and navigate to `http://localhost:5000/qr`

## Environment Variables

You can customize your bot by setting these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| OWNER_NUMBER | Your WhatsApp number with country code | Required |
| PREFIX | Command prefix | ! |
| GROUP_ONLY_MSG | Message when someone uses the bot in private | This bot only works in groups! |
| DISABLE_PM | Disable private messages | false |
| ENABLE_NSFW | Enable NSFW commands | false |
| LANGUAGE | Bot language | en |

## Persistent Storage

To keep your WhatsApp session active between container restarts:

```bash
docker run -d -p 5000:5000 \
  -e OWNER_NUMBER=your-number-here \
  -v $(pwd)/auth_data:/usr/src/app/auth_info_baileys \
  --name blackskymd-bot \
  blackskymd
```

This mounts a local directory to store the authentication data, so you don't need to re-scan the QR code after container restarts.

## Updating the Bot

To update to the latest version:

1. **Pull the latest code**:
   ```bash
   git pull
   ```

2. **Rebuild the container**:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

## Production Deployment Tips

For production deployments, consider these best practices:

1. **Use a reverse proxy** like Nginx or Traefik for SSL termination and security
2. **Set up health checks** to automatically restart the container if it becomes unresponsive
3. **Implement monitoring** using tools like Prometheus and Grafana
4. **Use Docker Swarm or Kubernetes** for orchestration if you need high availability

## Troubleshooting

If you encounter issues:

1. **Check container logs**:
   ```bash
   docker logs blackskymd-bot
   ```

2. **Restart the container**:
   ```bash
   docker restart blackskymd-bot
   ```

3. **Rebuild from scratch**:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Security Considerations

- Don't run the container as root (our Dockerfile already sets up a non-root user)
- Keep Docker and all dependencies updated
- Use network isolation when possible
- Consider using Docker secrets for sensitive information

## Need Help?

If you need assistance with Docker deployment, please open an issue on our [GitHub repository](https://github.com/madariss5/BLACKSKYMD/issues).