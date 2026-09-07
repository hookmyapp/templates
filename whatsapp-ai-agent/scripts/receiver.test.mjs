import { loadErrors } from './test-utils.mjs';
// Run: node --test scripts/receiver.test.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../lib/tunnel.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

test('receiver isolates app credentials, waits for signed delivery, and handles failure', async () => {
  const settings = {
    mode: 'sandbox', sandbox_session_id: 'ssn_12345678', hookmyapp_api_key: 'app-secret',
    hookmyapp_workspace_id: 'ws_12345678', hmac_secret: 'hmac-secret', verify_token: 'verify-secret',
  };
  let child, spawned, fail = false, legacy = false, probeCount = 0;
  const files = new Map();
  const diagnostics = [];
  let tick;
  const context = {
    exports: {}, URL, URLSearchParams, Response, AbortSignal, Date, setTimeout, clearTimeout,
    console: { error: (...parts) => diagnostics.push(parts.join(' ')) },
    process: { env: { NODE_ENV: 'development', HOOKMYAPP_CONFIG_DIR: '/unrelated-cli' }, cwd: () => '/app', execPath: '/node', once() {} },
    require(name) {
      if (name === 'node:path') return require(name).posix;
      if (name === './errors') return loadErrors(context.console);
      if (name === './db') return { getSettings: async () => settings };
      if (name === './hookmyapp') return { selfUrl: async () => 'http://localhost:3456' };
      if (name === 'node:fs') return {
        existsSync: () => legacy,
        mkdtempSync: () => '/private/receiver',
        writeFileSync: (path, body, options) => { assert.equal(options.mode, 0o600); files.set(path, JSON.parse(body)); },
        rmSync: () => files.clear(),
      };
      if (name === 'node:module') return { createRequire: () => Object.assign(() => ({ bin: { hookmyapp: 'cli.js' } }), { resolve: () => '/cli/package.json' }) };
      if (name === 'node:child_process') return { spawnSync: (command, args, options) => {
        assert.equal(command, 'taskkill.exe');
        assert.deepEqual(Array.from(args), ['/PID', '12345', '/T', '/F']);
        assert.equal(options.windowsHide, true);
        child.signalCode = 'SIGTERM'; child.emit('exit', null);
        return { status: 0 };
      }, spawn: (exe, args, options) => {
        spawned = { exe, args, options };
        child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        child.pid = 12345; child.exitCode = null; child.signalCode = null;
        child.kill = () => { child.signalCode = 'SIGTERM'; child.emit('exit', null); };
        return child;
      } };
      if (name === 'node:timers/promises') return { setTimeout: async () => tick() };
      return require(name);
    },
    fetch: async (url, options) => {
      probeCount++;
      assert.equal(context.exports.status().running, false, 'spawn/banner alone must not mean ready');
      assert.equal(context.exports.status().starting, true);
      assert.equal(String(url), 'http://127.0.0.1:3456/api/webhook/whatsapp', 'never probe the Cloudflare Access protected public URL');
      assert.equal(options.method, 'POST');
      const expected = require('node:crypto').createHmac('sha256', settings.hmac_secret).update(options.body).digest('hex');
      assert.equal(options.headers['x-hookmyapp-signature-256'], `sha256=${expected}`);
      assert.deepEqual(JSON.parse(options.body).entry, []);
      if (probeCount === 1) return new Response('', { status: 502 });
      return new Response('ok');
    },
  };
  vm.runInNewContext(source, context);
  const { start, stop, status } = context.exports;
  tick = () => {
    if (fail) { child.stderr.emit('data', Buffer.from('Error: Session expired. Run: hookmyapp login (AUTH_REQUIRED)')); child.exitCode = 4; child.emit('exit', 4); }
    else {
      // Real stdout may split a banner between chunks.
      child.stdout.emit('data', Buffer.from('✓ Tunnel act'));
      child.stdout.emit('data', Buffer.from('ive: https://receiver.example\n'));
    }
  };
  const ready = await start();
  assert.equal(ready.running, true);
  assert.equal(ready.starting, false);
  assert.ok(probeCount >= 2);
  assert.equal(spawned.options.env.HOOKMYAPP_CONFIG_DIR, '/private/receiver');
  assert.equal(context.process.env.HOOKMYAPP_CONFIG_DIR, '/unrelated-cli');
  assert.equal(files.get('/private/receiver/credentials.json').accessToken, 'app-secret');
  assert.equal(files.get('/private/receiver/config.json').activeWorkspaceId, settings.hookmyapp_workspace_id);
  assert.deepEqual(Array.from(spawned.args.slice(1)), ['sandbox', 'listen', '--session', 'ssn_12345678', '--port', '3456', '--path', '/api/webhook/whatsapp']);
  assert.ok(!spawned.args.includes('app-secret'));
  await stop(); assert.equal(status().running, false); assert.equal(files.size, 0);
  fail = true;
  await assert.rejects(start(), /could not sign you in/);
  assert.equal(status().running, false); assert.equal(files.size, 0);
  fail = false; settings.mode = 'live'; settings.channel_id = 'ch_12345678';
  await start();
  assert.deepEqual(Array.from(spawned.args.slice(1, 4)), ['channels', 'listen', 'ch_12345678']);
  await stop();
  let time = 0;
  context.Date = { now: () => time };
  context.fetch = async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }); };
  const emitBanner = tick;
  tick = () => { emitBanner(); time += 30_000; };
  await assert.rejects(start(), /Could not start receiving messages\. Please try again\./);
  assert.equal(status().error, 'Could not start receiving messages. Please try again.');
  assert.match(diagnostics.at(-1), /local webhook could not be reached/);
  assert.doesNotMatch(status().error, /DNS|receiver\.example|HTTP/);
  assert.equal(status().starting, false);
  await stop();
  assert.equal(status().error, null);
  context.process.platform = 'win32';
  context.fetch = async () => new Response('ok');
  tick = emitBanner;
  await start();
  assert.equal(spawned.options.windowsHide, true);
  await stop();
  assert.equal(status().running, false);
  assert.equal(files.size, 0);
  legacy = true;
  await assert.rejects(start(), /installation needs an update/);
  assert.equal(files.size, 0);
  let finish;
  const selecting = context.exports.receiveHere(() => new Promise(resolve => { finish = resolve; }));
  await assert.rejects(context.exports.receiveHere(async () => true), /Already connecting/);
  finish(true);
  await selecting;
});

test('selecting a number starts local receiving, skips it on deployment, and propagates failure', async () => {
  for (const kind of ['sandbox', 'channels']) {
    const source = ts.transpileModule(readFileSync(new URL(`../app/api/${kind}/select/route.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    let reachable = false, fail = false;
    const events = [];
    const context = { exports: {}, Response, require: (name) => {
      if (name === '@/lib/errors') return loadErrors();
      if (name === '@/lib/tunnel') return { receiveHere: async (configure) => {
        events.push('stop');
        if (await configure()) return null;
        events.push('start'); if (fail) throw new Error('auth failed'); return { running: true };
      } };
      if (name === '@/lib/db') return { saveSettings: async () => { events.push('save'); return { mode: kind }; } };
      return {
        activeSandboxSession: async () => ({ id: 'ssn_12345678', webhookUrl: 'https://previous.example/webhook' }), sandboxCredentials: () => ({}), channelCredentials: async () => ({}),
        isReachableFromOutside: async () => reachable, webhookUrl: async () => 'https://app.example/webhook',
        resetSandboxWebhook: async () => events.push('reset-webhook'), setSandboxWebhook: async () => events.push('webhook'), setWebhook: async () => events.push('webhook'),
      };
    } };
    vm.runInNewContext(source, context);
    const select = () => context.exports.POST({ json: async () => ({ channelId: 'ch_12345678' }) });
    assert.equal((await select()).status, 200);
    assert.deepEqual(events, kind === 'sandbox' ? ['stop', 'reset-webhook', 'save', 'start'] : ['stop', 'save', 'start']);
    events.length = 0; reachable = true;
    assert.equal((await select()).status, 200);
    assert.deepEqual(events, ['stop', 'webhook', 'save']);
    reachable = false; fail = true;
    assert.equal((await select()).status, 502);
  }
});
