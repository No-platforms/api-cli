# CI/CD CLI Controller

A secure web service that executes CLI commands based on authenticated HTTP requests.

## Features

- Secure API endpoint with API key authentication
- Rate limiting to prevent abuse
- Nginx reverse proxy configuration
- Environment-based command execution
- Logging system
- Health check endpoint
- Systemd service integration for automatic startup
- Docker support for containerized deployment
- GitHub Actions for automated Docker builds

## Setup

### Option 1: Docker (Recommended)

1. Install Docker and Docker Compose on your Ubuntu system:
   ```bash
   sudo apt-get update
   sudo apt-get install docker.io docker-compose
   ```

2. Configure your environment variables in `.env`
3. Build and start the containers:
   ```bash
   docker-compose up -d
   ```

   The service will be available on port 80 (Nginx) and 3000 (direct access).

### Option 2: Traditional Installation

1. Install dependencies:
   ```bash
   sudo apt update
   
   curl -fsSL https://deb.nodesource.com/setup_19.x | sudo -E bash -

   sudo apt install -y nodejs
   
   node -v

   npm install
   
   npm -v
   
   npm i
   ```

2. Configure your environment variables in `.env`:
   - Set your secure API_KEY
      
      You can generate safe token by run:
      ```
     date | sha512sum
     ```
   - Configure your CLI_COMMAND
   - Set your CLI_WORKING_DIR

3. Configure Nginx:
   - Copy the nginx.conf to your Nginx configuration directory
   - Restart Nginx

4. Install as a service (Ubuntu):
   ```bash
   sudo chmod +x install-service.sh
   sudo ./install-service.sh
   ```

   This will:
   - Install Node.js if not present
   - Create a dedicated service user
   - Set up the project in /opt/cicd-cli-controller
   - Create and enable a systemd service
   - Start the service automatically

5. Manual start (if not using service):
   ```bash
   npm start
   ```

## Usage

To trigger the CLI command, send a POST request to `/api/trigger` with your API key:

```bash
curl -X POST http://localhost/api/trigger \
  -H "X-API-Key: your-api-key-here"
```

## Security Features

- Helmet.js for security headers
- API key authentication
- Rate limiting
- CORS protection
- Nginx reverse proxy
- Request logging
- Dedicated service user
- Systemd service isolation
- Docker container isolation

## Health Check

Access the health check endpoint:

```bash
curl http://localhost/health
```

## Service Management

### Docker
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build
```

### Traditional Installation
Once installed as a service, you can manage it using systemctl:

```bash
sudo systemctl start cicd-cli-controller    # Start the service
sudo systemctl stop cicd-cli-controller     # Stop the service
sudo systemctl restart cicd-cli-controller  # Restart the service
sudo systemctl status cicd-cli-controller   # Check service status
```

## GitHub Actions

The project includes GitHub Actions workflow that automatically:
- Builds the Docker image
- Pushes to Docker Hub on successful builds
- Tags images based on git tags and commits
- Uses caching to speed up builds

To set up GitHub Actions:

1. Add these secrets to your GitHub repository:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Your Docker Hub access token (not password)

2. Push to the main branch or create a tag to trigger the workflow