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
  // The simulated dumbbell starts its first set within about 11 seconds.
  await sleep(13_000);
  if (exited) throw new Error(`Production server exited early:\n${logs}`);
  let response = await request('/api/trainings');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const snapshot = await response.json();
  assert(
    snapshot.status.saved >= 1,
    'collector should save a fresh event before any browser/API request'
  );
  assert.equal(snapshot.status.connection, 'connected');
  assert.equal(snapshot.status.rejected, 0);
  // 15 seeded sets (start + end each) plus the fresh start event.
  assert(snapshot.events.length >= 31);
  assert.equal(snapshot.latest.type, 'start');
  assert.equal((await request('/api/trainings?limit=9999')).status, 400);
  assert.equal((await request('/api/trainings?days=31')).status, 400);
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
  const state = await (await request('/api/device/state')).json();
  // The set in progress keeps counting after the reset, but at most 15 repetitions.
  assert(Number.isInteger(state.totalCount) && state.totalCount >= 0 && state.totalCount <= 15);
  assert.equal(state.sensorOk, true);
  // A second read within five seconds is served from the shared cache.
  assert.equal((await (await request('/api/device/state')).json()).readAt, state.readAt);
  const html = await (await request('/')).text();
  assert(html.includes('Training overview'));
  assert(!html.includes('smoke-test-secret-must-not-leak'));
  assert(!JSON.stringify(snapshot).includes('smoke-test-secret-must-not-leak'));
  assert.equal((await request('/guide')).status, 200);
  // Two device requests so far (reset + one uncached read); the budget allows 20 per minute.
  const reset = () =>
    request('/api/device/reset', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{}'
    });
  for (let i = 0; i < 18; i++) assert.equal((await reset()).status, 200);
  assert.equal((await reset()).status, 429);
  console.log(
    'Production smoke checks passed: unattended startup, set ingestion, history, device cache, controls, origin/rate limits, pages and secret boundary.'
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
