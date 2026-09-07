import { loadErrors } from './test-utils.mjs';
// Run: node --test scripts/integration-contracts.test.mjs
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

test('HookMyApp contracts: channel wire fields, PUT webhook, sandbox send, local hosts', async () => {
  let host = 'localhost:3456';
  const requests = [];
  const diagnostics = [];
  const context = {
    exports: {}, URL, Response, AbortSignal, process: { env: {} },
    console: { error: (...args) => diagnostics.push(args) },
    require: (name) => name === './errors' ? loadErrors(context.console) : name === 'next/headers' ? { headers: async () => new Headers({ host }) }
      : { getSettings: async () => ({ hookmyapp_api_key: 'hmok-test', hookmyapp_workspace_id: 'ws_12345678' }) },
    fetch: async (url, opts) => {
      requests.push({ url, opts });
      if (url.endsWith('/meta/channels')) return Response.json([
        // Backend meta.controller.ts GET channels returns id/type, not publicId/channelType.
        { id: 'ch_12345678', type: 'whatsapp', whatsappVerifiedName: 'Shop', whatsappDisplayPhoneNumber: '+15551234567' },
        { id: 'ch_87654321', type: 'instagram' },
      ]);
      if (url.endsWith('/env')) return Response.json({ values: {
        META_GRAPH_API_URL: 'https://gateway.hookmyapp.com/meta/v24.0', WHATSAPP_PHONE_NUMBER_ID: 'real-phone-id',
        WHATSAPP_ACCESS_TOKEN: 'hmat-test', WEBHOOK_HMAC_SECRET: 'hmac', VERIFY_TOKEN: 'verify',
      }, defaults: {} });
      if (url.endsWith('/messages')) return Response.json({ messages: [{ id: 'message-id' }] });
      return Response.json({ ok: true });
    },
  };
  vm.runInNewContext(compile('../lib/hookmyapp.ts'), context);
  const h = context.exports;
  const channels = await h.listChannels();
  assert.equal(channels.length, 1); assert.equal(channels[0].publicId, 'ch_12345678');
  assert.equal(channels[0].displayName, 'Shop');
  await h.setWebhook(channels[0].publicId, 'https://app.example/webhook', 'verify');
  assert.equal(requests.at(-1).opts.method, 'PUT');
  assert.equal(requests.at(-1).opts.headers['X-Workspace-Id'], 'ws_12345678');
  const live = await h.channelCredentials('ch_12345678');
  await h.sendText(live, '15551234567', 'test');
  assert.equal(requests.at(-1).url, 'https://gateway.hookmyapp.com/meta/v24.0/real-phone-id/messages');
  assert.equal(requests.at(-1).opts.headers.Authorization, 'Bearer hmat-test');
  const sandbox = h.sandboxCredentials({ sandboxPhoneNumberId: 'sandbox-phone-id', whatsappApiVersion: 'v24.0', accessToken: 'session-token', hmacSecret: 'hmac', verifyToken: 'verify' });
  await h.sendText(sandbox, '15551234567', 'test');
  assert.equal(requests.at(-1).url, 'https://sandbox.hookmyapp.com/v24.0/sandbox-phone-id/messages');
  assert.equal(requests.at(-1).opts.headers.Authorization, 'Bearer session-token');
  assert.throws(() => h.sandboxCredentials({}), /incomplete/);
  for (host of ['localhost:3456', '127.0.0.1:3456', '[::1]:3456', '192.168.1.12:3456', '10.0.0.8:3456']) {
    assert.equal(await h.isReachableFromOutside(), false, host);
    assert.ok((await h.selfUrl()).startsWith('http://'));
  }
  host = 'agent.example.com'; assert.equal(await h.isReachableFromOutside(), true);
  context.fetch = async () => Response.json({ code: 'ACCESS_TOKEN_INVALID', message: 'provider internals', requestId: 'trace-id' }, { status: 401 });
  await assert.rejects(h.sendText(sandbox, '15551234567', 'test'), /^Error: Could not send the reply\. Please try again\.$/);
  assert.equal(diagnostics.at(-1)[1].code, 'ACCESS_TOKEN_INVALID');
});

test('saved sandbox endpoint is repaired; real-number settings remain unchanged', async () => {
  const db = await PGlite.create();
  const source = compile('../lib/db.ts');
  const load = () => {
    const context = { exports: {}, URL, process: { env: { DATABASE_URL: 'postgres://test' } }, require: (name) => {
      if (name === '@neondatabase/serverless') return { neonConfig: {}, neon: () => ({ query: async (sql, values) => (await db.query(sql, values)).rows }) };
      return require(name);
    } };
    vm.runInNewContext(source, context); return context.exports;
  };
  try {
    const initial = load();
    await initial.getSettings();
    await initial.addMessage({ contact: 'test', direction: 'out', body: '', error: 'Send failed (401): secret-value' });
    assert.equal((await initial.contacts())[0].last_body, 'Could not answer this message.');
    await db.query("UPDATE settings SET mode='sandbox', api_base='https://gateway.hookmyapp.com/meta/v24.0', channel_token='session-token'");
    const fixed = await load().getSettings();
    assert.equal(fixed.api_base, 'https://sandbox.hookmyapp.com/v24.0');
    assert.equal(fixed.channel_token, 'session-token');
    await db.query("UPDATE settings SET mode='live', api_base='https://gateway.hookmyapp.com/meta/v24.0'");
    assert.equal((await load().getSettings()).api_base, 'https://gateway.hookmyapp.com/meta/v24.0');
  } finally { await db.close(); }
});

test('signature validation rejects malformed multibyte headers without crashing', () => {
  const context = { exports: {}, Buffer, require };
  vm.runInNewContext(compile('../lib/whatsapp.ts'), context);
  const { verifySignature } = context.exports;
  const body = '{"entry":[]}';
  const signature = createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(verifySignature(body, `sha256=${signature}`, 'secret'), true);
  for (const bad of ['é'.repeat(64), 'x'.repeat(64), null, 'sha256=short']) assert.equal(verifySignature(body, bad, 'secret'), false);
  assert.equal(verifySignature('changed', signature, 'secret'), false);
});
