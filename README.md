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
API_KEY=<at least 32 characters>
CLI_COMMAND=/absolute/path/to/your-script.sh
CLI_WORKING_DIR=/path/to/working/dir
PORT=3000
HOST=127.0.0.1
```

Generating a secure key locally:

```bash
date | sha512sum | cut -c1-64
```

API
- POST /api/trigger — runs `CLI_COMMAND` once with the given argument.
  - Header: `X-API-Key: <API_KEY>` (at least 32 characters)
  - Body (JSON): `{ "arg": "Dev-1.2.3" }`. `arg` must match `CLI_ARG_PATTERN`.
  - Response: `text/event-stream` with the program's output, then `Command completed with code N`.
  - Returns `409` if another run is already in progress, `401` for a bad key, `400` for a bad body.
- GET /health — returns 200 OK when the service is healthy.

Example trigger

```bash
curl -N -X POST https://your-host/api/trigger \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"arg":"Dev-1.2.3"}'
```

Security model
- The program is started with `spawn` and an argument array, with no shell. Shell characters in `arg` are never interpreted.
- `CLI_COMMAND` must be an absolute path to a program, without spaces or arguments. The service refuses to start otherwise.
- The API key is compared in constant time against a SHA-256 digest of itself.
- The service listens on `127.0.0.1` by default. Put TLS and access control in front of it (nginx in this repo, or a firewall or VPN).
- Only one run at a time. Each run is stopped after `CLI_TIMEOUT_MS`.
- A client disconnect does not stop a running command, so a deploy is never cut off halfway.

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
