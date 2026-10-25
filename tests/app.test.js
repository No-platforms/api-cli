import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';

const here = dirname(fileURLToPath(import.meta.url));
const KEY = 'k'.repeat(40);
const quietLogger = { info() {}, warn() {}, error() {} };

function envFor(program, extra = {}) {
  return { API_KEY: KEY, CLI_COMMAND: join(here, 'fixtures', program), CLI_WORKING_DIR: here, ...extra };
}

async function start(env) {
  const config = loadConfig(env);
  const app = createApp(config, quietLogger);
  const server = createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

const post = (base, body, headers = {}) => fetch(`${base}/api/trigger`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': KEY, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

let svc;
before(async () => { svc = await start(envFor('echo.sh')); });
after(async () => { await svc.close(); });

test('rejects a missing API key', async () => {
  const res = await post(svc.base, { arg: 'Dev-1' }, { 'x-api-key': '' });
  assert.equal(res.status, 401);
});

test('rejects a wrong API key', async () => {
  const res = await post(svc.base, { arg: 'Dev-1' }, { 'x-api-key': 'x'.repeat(40) });
  assert.equal(res.status, 401);
});

test('rejects a missing argument', async () => {
  const res = await post(svc.base, {});
  assert.equal(res.status, 400);
});

test('rejects shell metacharacters in the argument', async () => {
  const res = await post(svc.base, { arg: 'Dev-1;touch /tmp/pwned' });
  assert.equal(res.status, 400);
});

test('rejects a non-string argument', async () => {
  const res = await post(svc.base, { arg: ['Dev-1'] });
  assert.equal(res.status, 400);
});

test('rejects malformed JSON without leaking details', async () => {
  const res = await post(svc.base, '{not json');
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Bad request' });
});

test('runs the program with the tag as a single argument and streams output', async () => {
  const res = await post(svc.base, { arg: 'Dev-1.2.3' });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /data: ARG=Dev-1\.2\.3/);
  assert.match(text, /Command completed with code 0/);
});

test('health endpoint answers', async () => {
  const res = await fetch(`${svc.base}/health`);
  assert.equal(res.status, 200);
});

test('a second run is refused while one is in progress', async () => {
  const first = post(svc.base, { arg: 'Sleep' });
  await new Promise((r) => setTimeout(r, 300));
  const second = await post(svc.base, { arg: 'Dev-2' });
  assert.equal(second.status, 409);
  const done = await first;
  await done.text();
});

test('a run is stopped after CLI_TIMEOUT_MS', async () => {
  const slow = await start(envFor('slow.sh', { CLI_TIMEOUT_MS: '500' }));
  try {
    const res = await post(slow.base, { arg: 'Dev-3' });
    const text = await res.text();
    assert.match(text, /Timed out after 500 ms/);
  } finally {
    await slow.close();
  }
});

test('config refuses a short API key', () => {
  assert.throws(() => loadConfig(envFor('echo.sh', { API_KEY: 'short' })), /at least 32/);
});

test('config refuses a command with arguments or spaces', () => {
  assert.throws(() => loadConfig(envFor('echo.sh', { CLI_COMMAND: `${join(here, 'fixtures', 'echo.sh')} x` })), /without spaces/);
});

test('config refuses a relative command path', () => {
  assert.throws(() => loadConfig(envFor('echo.sh', { CLI_COMMAND: './echo.sh' })), /absolute path/);
});

test('config refuses a missing command', () => {
  assert.throws(() => loadConfig(envFor('echo.sh', { CLI_COMMAND: join(here, 'nope.sh') })), /does not exist/);
});

test('config accepts a TRUST_PROXY subnet and defaults to no trust', () => {
  assert.equal(loadConfig(envFor('echo.sh', { TRUST_PROXY: '172.18.0.0/16' })).trustProxy, '172.18.0.0/16');
  assert.equal(loadConfig(envFor('echo.sh')).trustProxy, false);
});
