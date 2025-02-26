FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install Nginx
RUN apt-get update && apt-get install -y nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create log directory
RUN mkdir -p logs && \
    touch logs/combined.log logs/error.log && \
    chown -R node:node logs

# Switch to non-root user
USER node

# Expose ports
EXPOSE 3000 80

# Start Nginx and Node.js app
CMD ["./docker-entrypoint.sh"]