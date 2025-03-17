FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies 
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    wget \
    imagemagick \
    webp \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Twilio for SMS features if needed
RUN pip3 install twilio

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p auth_info_baileys data/reaction_gifs logs temp

# Create a non-root user
RUN useradd -m blackskymd
RUN chown -R blackskymd:blackskymd /usr/src/app

# Switch to non-root user
USER blackskymd

# Expose port for web interface
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Start bot with cloud-optimized server
CMD ["node", "src/cloud-qr-server.js"]