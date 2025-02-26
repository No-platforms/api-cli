#!/bin/bash

# Exit on any error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (use sudo)"
  exit 1
fi

# Configuration
PROJECT_DIR="/opt/cicd-cli-controller"
SERVICE_NAME="cicd-cli-controller"
SERVICE_USER="cicd-service"
NODE_VERSION="20.x"

echo "Installing CICD CLI Controller Service..."

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash -
    apt-get install -y nodejs
fi

# Create service user if not exists
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false $SERVICE_USER
fi

# Create project directory and set permissions
mkdir -p $PROJECT_DIR
cp -r ./* $PROJECT_DIR/
chown -R $SERVICE_USER:$SERVICE_USER $PROJECT_DIR

# Install dependencies
cd $PROJECT_DIR
npm install --production

# Create systemd service file
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOL
[Unit]
Description=CICD CLI Controller Service
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${SERVICE_NAME}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

echo "Service installation completed!"
echo "Service status:"
systemctl status ${SERVICE_NAME}

echo "
Installation complete! The service is now:
- Installed in ${PROJECT_DIR}
- Running as system service (${SERVICE_NAME})
- Configured to start automatically on boot
- Running as dedicated user ${SERVICE_USER}

You can manage the service with:
systemctl start ${SERVICE_NAME}
systemctl stop ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}
systemctl status ${SERVICE_NAME}
"