# CI/CD CLI Controller

A secure web service that executes CLI commands based on authenticated HTTP requests.

## Features
# CI/CD CLI Controller

Purpose

This repository implements a small, secure HTTP-driven command executor intended to run pre-configured, non-interactive shell commands in response to authenticated API requests. It is designed as a safe bridge between event sources (webhooks, internal dashboards, or CI systems) and deterministic maintenance or deployment scripts. Security is a first-class concern: the service is meant to be used with vetted commands, API-key authentication, logging, rate limiting, and optional network isolation (reverse proxy, containerization). Operators should only expose this API to trusted networks, use TLS, restrict allowed commands, and run the service with least privilege.

Safe Use Cases

- Triggering a vetted deployment script on an internal network (pull, build, and restart) during controlled release windows.
- Running non-destructive maintenance tasks such as clearing caches, rotating logs, or syncing files to an internal backup target.
- Kicking off database migration scripts in a scheduled maintenance window after thorough validation.
- Starting/stopping internal services or jobs in an environment protected by access controls and auditing.
- Collecting diagnostics (log bundles, system information) for support or monitoring without exposing sensitive data.
- Launching test runs or build jobs that generate artifacts for internal CI pipelines.

Security notes: always whitelist commands (do not accept arbitrary shell input), keep `API_KEY` secret and rotated, serve behind TLS and a firewall or VPN, run the service as an unprivileged user or inside a container, and log and monitor all requests.

Highlights
- Secure API endpoint with API-key authentication
- Rate limiting and CORS protection
- Optional Nginx reverse proxy
- Dockerized for easy deployment
- Systemd installation script for traditional hosts
- Health check and request logging

Quick Links
- Usage: POST /api/trigger
- Health: GET /health
- Code: index.js, src/server.js

Requirements
- Docker (recommended) or Node.js >= 16 and npm
- Linux host (Ubuntu is supported by provided scripts)

Quick Start (Docker - recommended)

1. Create a `.env` in the project root with required variables (see Env section).
2. Build and run:

```bash
docker-compose up -d --build
```

3. View logs:

```bash
docker-compose logs -f
```

Start Without Docker (traditional install)

1. Install Node.js and dependencies:

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
npm install
```

2. Configure `.env` and start:

```bash
npm start
```

3. To install as a systemd service (Ubuntu):

```bash
sudo chmod +x install-service.sh
sudo ./install-service.sh
```

Environment (important)
Create a `.env` file with at least the following values:

```
API_KEY=your-secure-api-key
CLI_COMMAND=./your-script.sh
CLI_WORKING_DIR=/path/to/working/dir
PORT=3000
```

Generating a secure key locally:

```bash
date | sha512sum | cut -c1-64
```

API
- POST /api/trigger — triggers the configured CLI command.
  - Header: `X-API-Key: <API_KEY>`
  - Response: JSON with status and optional command output or error.

- GET /health — returns 200 OK when the service is healthy.

Example trigger

```bash
curl -X POST http://localhost/api/trigger -H "X-API-Key: your-api-key"
```

Logging
- Logs are written to the `logs/` directory by default (see project files).

Deployment Notes
- The included `nginx.conf` is a ready-to-use reverse proxy config — adapt upstream/SSL as needed.
- `docker-compose.yml` starts the app and nginx for production-like testing.
- The `install-service.sh` script sets up a systemd service and places the app under `/opt/cicd-cli-controller` by default.

Security Best Practices
- Keep `API_KEY` secret and rotate it periodically.
- Serve the API behind TLS (terminate TLS at Nginx or an external proxy).
- Run the service with a dedicated, unprivileged user when using systemd.
- Restrict access to the host and control network rules if exposing the API.

CI/CD
- A GitHub Actions workflow is included to build and push Docker images. Add Docker Hub credentials as repository secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`) to enable publishing.

Troubleshooting
- If the service doesn't start, check `docker-compose logs` or `journalctl -u cicd-cli-controller` for systemd installs.
- Ensure `CLI_COMMAND` is executable and `CLI_WORKING_DIR` exists.

Contributing
- Open issues or pull requests. Keep changes small and include tests where appropriate.

License
- MIT (or choose your preferred license)
