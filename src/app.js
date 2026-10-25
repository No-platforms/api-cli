import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Build the HTTP app. Pure: no listening, no env reads, so tests can drive it.
 *
 * @param {ReturnType<import('./config.js').loadConfig>} config
 * @param {{ info: Function, warn: Function, error: Function }} logger
 */
export function createApp(config, logger) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(helmet());
  app.use(express.json({ limit: '1kb' }));

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }));

  const expectedDigest = sha256(config.apiKey);
  const requireApiKey = (req, res, next) => {
    const given = req.get('x-api-key') ?? '';
    if (!timingSafeEqual(sha256(given), expectedDigest)) {
      logger.warn(`unauthorized request from ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  };

  // Only one run at a time: a deploy must never overlap another deploy.
  let busy = false;

  app.post('/api/trigger', requireApiKey, (req, res) => {
    const arg = req.body?.arg;
    if (typeof arg !== 'string' || !config.argPattern.test(arg)) {
      return res.status(400).json({ error: 'Invalid or missing "arg"' });
    }
    if (busy) {
      return res.status(409).json({ error: 'Another run is in progress' });
    }

    busy = true;
    logger.info(`trigger accepted: arg=${arg}`);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // argv array, no shell: the argument is never interpreted by a shell.
    const child = spawn(config.command, [arg], {
      cwd: config.workingDir,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const killer = setTimeout(() => {
      emit(`Timed out after ${config.timeoutMs} ms; stopping process`);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
    }, config.timeoutMs);

    const emit = (line) => {
      for (const part of String(line).split(/\r?\n/)) {
        if (part.trim()) res.write(`data: ${part}\n\n`);
      }
    };
    const streamOf = (stream, label) => {
      let pending = '';
      stream.on('data', (chunk) => {
        pending += chunk.toString();
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        for (const line of lines) {
          logger.info(`${label}: ${line}`);
          emit(line);
        }
      });
      stream.on('end', () => {
        if (pending) {
          logger.info(`${label}: ${pending}`);
          emit(pending);
        }
      });
    };
    streamOf(child.stdout, 'STDOUT');
    streamOf(child.stderr, 'STDERR');

    let finished = false;
    const finish = (message) => {
      if (finished) return;
      finished = true;
      clearTimeout(killer);
      busy = false;
      logger.info(message);
      emit(message);
      res.end();
    };

    child.on('error', (error) => finish(`Error: ${error.message}`));
    child.on('close', (code, signal) => {
      finish(`Command completed with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`);
    });

    // A dropped client must not stop a deploy halfway. Only log it.
    req.on('close', () => {
      if (!finished) logger.warn('client disconnected; run continues to completion');
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy' });
  });

  // Malformed JSON and other request errors: generic answer, no stack trace.
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err?.status === 400) {
      return res.status(400).json({ error: 'Bad request' });
    }
    logger.error(`request error: ${err?.message ?? err}`);
    return res.status(500).json({ error: 'Internal error' });
  });

  return app;
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest();
}
