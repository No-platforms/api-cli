import { config as loadDotenv } from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

loadDotenv({ quiet: true });

export function buildLogger(logDir = 'logs') {
  return createLogger({
    format: format.combine(
      format.timestamp(),
      format.json(),
      // Never write the API key, even if it reaches a log line by mistake.
      format((info) => {
        if (typeof info.message === 'string') {
          info.message = info.message.replace(/x-api-key[=:]\s*\S+/gi, 'x-api-key=[redacted]');
        }
        return info;
      })()
    ),
    transports: [
      new transports.Console(),
      new transports.File({ filename: `${logDir}/error.log`, level: 'error' }),
      new transports.File({ filename: `${logDir}/combined.log` }),
    ],
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const logger = buildLogger();
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    logger.error(`invalid configuration: ${error.message}`);
    process.exit(1);
  }

  const app = createApp(config, logger);
  app.listen(config.port, config.host, () => {
    logger.info(`listening on http://${config.host}:${config.port}`);
  });
}

export { createApp, loadConfig };
