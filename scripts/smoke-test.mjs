import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

// An ephemeral port and explicit mock env avoid real credentials and other servers.
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const address = reservation.address();
assert(address && typeof address === 'object');
const port = address.port;
await new Promise((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve()))
);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/start.mjs'], {
  cwd: new URL('../', import.meta.url),
  env: {
    ...process.env,
    APP_MODE: 'mock',
    HOST: '127.0.0.1',
    PORT: String(port),
    APP_ORIGIN: origin,
    PARTICLE_CLIENT_SECRET: 'smoke-test-secret-must-not-leak',
    SHUTDOWN_TIMEOUT: '1'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
server.stdout.on('data', (chunk) => {
  logs += chunk;
});
server.stderr.on('data', (chunk) => {
  logs += chunk;
});
let exited = false;
server.on('exit', () => {
  exited = true;
});
const request = (path, init) =>
  fetch(origin + path, { ...init, signal: AbortSignal.timeout(15_000) });

try {
  // Do not request the dashboard yet: prove collection starts without visitors.
  const startupDeadline = Date.now() + 15_000;
  while (!logs.includes('Listening on') && !exited && Date.now() < startupDeadline) await sleep(50);
  assert(logs.includes('Listening on'), 'Production server should announce startup.');
  await sleep(11_500);
  if (exited) throw new Error(`Production server exited early:\n${logs}`);
  let response = await request('/api/readings');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  let snapshot = await response.json();
  assert(
    snapshot.status.saved >= 1,
    'collector should save a fresh event before any browser/API request'
  );
  assert.equal(snapshot.status.connection, 'connected');
  assert(snapshot.readings.length >= 61);
  assert(snapshot.latest.counter >= 6100);
  assert.equal((await request('/api/readings?limit=9999')).status, 400);
  assert.equal(
    (
      await request('/api/device/reset', {
        method: 'POST',
        headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
        body: '{}'
      })
    ).status,
    403
  );
  response = await request('/api/device/reset', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).returnValue, 0);
  response = await request('/api/device/variable');
  const valueAfterReset = (await response.json()).value;
  // The counter continues ticking every 100 ms after reset.
  assert(Number.isInteger(valueAfterReset) && valueAfterReset >= 0 && valueAfterReset < 100);
  snapshot = await (await request('/api/readings')).json();
  assert.equal(snapshot.latest.counter, 0);
  const html = await (await request('/')).text();
  assert(html.includes('Device overview'));
  assert(!html.includes('smoke-test-secret-must-not-leak'));
  assert(!JSON.stringify(snapshot).includes('smoke-test-secret-must-not-leak'));
  assert.equal((await request('/guide')).status, 200);
  for (let i = 0; i < 18; i++) assert.equal((await request('/api/device/variable')).status, 200);
  assert.equal((await request('/api/device/variable')).status, 429);
  console.log(
    'Production smoke checks passed: unattended startup, ingestion, history, controls, origin/rate limits, pages and secret boundary.'
  );
} finally {
  server.kill('SIGTERM');
  const deadline = Date.now() + 5000;
  while (!exited && Date.now() < deadline) await sleep(50);
  if (!exited) {
    server.kill('SIGKILL');
    throw new Error('Production server did not shut down gracefully.');
  }
}
