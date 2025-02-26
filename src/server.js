import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { createLogger, format, transports } from 'winston';
import * as process from "node:process";

// Load environment variables
config();

// Create logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ]
});

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// API key middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn(`Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Execute CLI command with streaming
const executeCLICommand = (res) => {
  const command = process.env.CLI_COMMAND;
  const workingDir = process.env.CLI_WORKING_DIR;

  if (!command) {
    throw new Error('CLI command not configured');
  }

  // Split command into program and arguments
  const [cmd, ...args] = command.split(' ');
  
  // Spawn the process
  const processWithoutNullStreams = spawn(cmd, args, {
    cwd: workingDir,
    shell: true
  });

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Stream stdout
  processWithoutNullStreams.stdout.on('data', (data) => {
    const output = data.toString();
    logger.info(`Command output: ${output}`);
    res.write(`data: ${output}\n\n`);
  });

  // Stream stderr
  processWithoutNullStreams.stderr.on('data', (data) => {
    const error = data.toString();
    logger.error(`response: ${error}`);
    res.write(`data: ${error}\n\n`);
    // res.end();
  });

  // Handle process completion
  processWithoutNullStreams.on('close', (code) => {
    logger.info(`Command completed with code ${code}`);
    res.write(`data: ${code}\n\n`);
    // res.end();
  });

  // Handle process errors
  processWithoutNullStreams.on('error', (error) => {
    logger.error(`Response: ${error.message}`);
    res.write(`data: Response: ${error.message}\n\n`);
    // res.end();
  });
};

// Routes
app.post('/api/trigger', apiKeyAuth, (req, res) => {
  try {
    logger.info('Received trigger request');
    executeCLICommand(res);
  } catch (error) {
    logger.error(`Error executing command: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  logger.info(`Server running at http://${HOST}:${PORT}`);
});