// Run after npm run build in a clean checkout. No account keys or messages are used.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

for (const file of ['.pglite', '.env', '.env.local', '.env.production', '.env.production.local']) {
  assert.ok(!existsSync(file), `Use a clean checkout for this check; ${file} already exists.`);
}
for (const key of ['DATABASE_URL', 'HOOKMYAPP_API_KEY', 'HOOKMYAPP_WORKSPACE_ID', 'OPENROUTER_API_KEY']) {
  assert.ok(!process.env[key], `Unset ${key} before running this check.`);
}

const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', resolve);
});
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));

const require = createRequire(import.meta.url);
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});
let startError;
server.once('error', (error) => { startError = error; });
const base = `http://127.0.0.1:${port}`;

try {
  let response;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (startError) throw startError;
    assert.equal(server.exitCode, null, 'The new server exited before it was ready.');
    response = await fetch(`${base}/api/settings`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (response) break;
    await delay(250);
  }
  assert.equal(response?.status, 200, 'Fresh settings request must succeed.');
  const settings = await response.json();
  assert.equal(settings.connected, false);
  assert.deepEqual(settings.keys, { hookmyapp: null, workspace: null, openrouter: null });
  assert.equal(settings.reachable, false);
  for (const path of ['/', '/settings', '/playground', '/api/messages', '/api/models']) {
    const result = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(result.status, 200, path);
  }
  console.log('Clean-start checks passed. No account keys or messages were used.');
} finally {
  if (server.pid && server.exitCode === null && server.signalCode === null) {
    const closed = new Promise((resolve) => server.once('exit', resolve));
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
      assert.equal(result.status, 0, 'Could not stop the smoke-test server.');
    } else {
      server.kill('SIGTERM');
    }
    await closed;
  }
  rmSync('.pglite', { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
