#!/bin/bash
# Install the trigger service as a systemd unit under a dedicated system user.
#
# Requirements (checked, not installed for you):
#   - run as root
#   - Node.js >= 20 already installed (no `curl | bash` installers)
#   - a .env file in this directory, created from .env.example
#
# Security notes:
#   - the service runs as ${SERVICE_USER}, not root
#   - .env is readable by root and ${SERVICE_USER} only (mode 640)
#   - membership in the docker group is root-equivalent; it is granted only
#     because the deploy command needs docker. Keep the deploy script narrow.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="cicd-cli-controller"
SERVICE_USER="cicd-service"

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "Node.js >= 20 is required. Install it first, then re-run." >&2
  exit 1
fi
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js >= 20 is required (found major $NODE_MAJOR)." >&2
  exit 1
fi

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "Create $PROJECT_DIR/.env from .env.example first." >&2
  exit 1
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

if getent group docker >/dev/null; then
  usermod -aG docker "$SERVICE_USER"
else
  echo "WARNING: no docker group found; deploy commands that need docker will fail." >&2
fi

chown root:"$SERVICE_USER" "$PROJECT_DIR/.env"
chmod 640 "$PROJECT_DIR/.env"

mkdir -p "$PROJECT_DIR/logs"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$PROJECT_DIR/logs"

# SKIP_NPM_CI=1 reuses an existing node_modules (e.g. one copied from a verified build).
if [ -z "${SKIP_NPM_CI:-}" ]; then
  (cd "$PROJECT_DIR" && npm ci --omit=dev --no-audit --no-fund)
fi

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=CICD CLI Controller Service
After=network.target docker.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${NODE_BIN} src/server.js
EnvironmentFile=${PROJECT_DIR}/.env
Restart=on-failure
RestartSec=10
NoNewPrivileges=yes
PrivateTmp=yes
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl --no-pager status "$SERVICE_NAME" || true
echo "Installed. Logs: journalctl -u ${SERVICE_NAME} -f"
