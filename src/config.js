import { existsSync, statSync, accessSync, constants } from 'node:fs';
import { isAbsolute } from 'node:path';

const DEFAULT_ARG_PATTERN = '^[A-Za-z0-9._-]{1,128}$';
const MIN_API_KEY_LENGTH = 32;

/**
 * Read and validate configuration. Throws on anything unsafe so the service
 * never starts in a half-configured state.
 *
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env) {
  const apiKey = env.API_KEY ?? '';
  if (apiKey.length < MIN_API_KEY_LENGTH) {
    throw new Error(`API_KEY must be at least ${MIN_API_KEY_LENGTH} characters`);
  }

  // The command is a program path only. No arguments, no shell syntax.
  const command = env.CLI_COMMAND ?? '';
  if (!isAbsolute(command) || /\s/.test(command)) {
    throw new Error('CLI_COMMAND must be an absolute path to a program, without spaces');
  }
  if (!existsSync(command) || !statSync(command).isFile()) {
    throw new Error(`CLI_COMMAND does not exist: ${command}`);
  }
  accessSync(command, constants.X_OK);

  const workingDir = env.CLI_WORKING_DIR || process.cwd();
  if (!existsSync(workingDir) || !statSync(workingDir).isDirectory()) {
    throw new Error(`CLI_WORKING_DIR is not a directory: ${workingDir}`);
  }

  const argPatternSource = env.CLI_ARG_PATTERN || DEFAULT_ARG_PATTERN;
  let argPattern;
  try {
    argPattern = new RegExp(argPatternSource);
  } catch {
    throw new Error('CLI_ARG_PATTERN is not a valid regular expression');
  }

  const timeoutMs = Number(env.CLI_TIMEOUT_MS || 30 * 60 * 1000);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('CLI_TIMEOUT_MS must be a positive integer');
  }

  return {
    apiKey,
    command,
    workingDir,
    argPattern,
    timeoutMs,
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT || 3000),
    rateLimitMax: Number(env.RATE_LIMIT_MAX || 100),
  };
}
