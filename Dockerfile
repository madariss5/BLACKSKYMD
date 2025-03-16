FROM node:18

# Install dependencies for canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY heroku-package.json ./package.json
COPY heroku-bot.js .
COPY src ./src
COPY public ./public
COPY views ./views

# Install app dependencies
RUN npm install

# Create authentication directory
RUN mkdir -p auth_info_heroku

# Expose port
EXPOSE 8000

# Start app
CMD [ "npm", "start" ]