import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { loadErrors } from './test-utils.mjs';

const source = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const raw = 'Send failed (401): {"code":"ACCESS_TOKEN_INVALID","token":"secret-value"} receiver.internal DNS';
const fault = () => { throw new Error(raw); };

test('only approved messages survive errors, browser failures, and diagnostic logging', async () => {
  const logs = [];
  const messages = loadErrors({ error: (...args) => logs.push(args) });
  const { errors, publicError, reportError } = messages;
  for (const value of [raw, new Error(raw), { message: raw }, { error: raw }, null, undefined]) {
    assert.equal(publicError(value, errors.connect), errors.connect);
  }
  for (const message of Object.values(errors)) {
    assert.equal(publicError(new Error(message)), message);
  }
  reportError('send', Object.assign(new Error(raw), { status: 401, code: 'ACCESS_TOKEN_INVALID', requestId: 'trace-123' }));
  assert.equal(logs[0][1].code, 'ACCESS_TOKEN_INVALID');
  assert.doesNotMatch(JSON.stringify(logs), /secret-value|receiver.internal/);

  const context = { exports: {}, AbortSignal, require: () => messages, fetch: fault };
  vm.runInNewContext(source('../lib/api-client.ts'), context);
  const request = () => context.exports.requestJson('/api/test', undefined, errors.save);
  for (const fetch of [
    fault,
    async () => { throw new DOMException(raw, 'TimeoutError'); },
    async () => new Response(`<html>${raw}</html>`, { status: 502 }),
    async () => Response.json({ error: raw }, { status: 401 }),
  ]) {
    context.fetch = fetch;
    await assert.rejects(request(), (error) => error.message === errors.save);
  }
  context.fetch = async () => Response.json({ error: errors.hookAuth }, { status: 401 });
  await assert.rejects(request(), (error) => error.message === errors.hookAuth);
  context.fetch = async () => Response.json({ ok: true });
  assert.equal((await request()).ok, true);
});

test('all user API failure boundaries hide raw exceptions, including old conversation errors', async () => {
  const messages = loadErrors();
  const cases = [
    ['settings', 'GET'], ['settings', 'PUT'], ['models', 'GET'], ['messages', 'GET'],
    ['channels', 'GET'], ['channels/select', 'POST'], ['sandbox', 'GET'],
    ['sandbox/select', 'POST'], ['sandbox/release', 'POST'], ['connect/start', 'POST'],
    ['tunnel', 'DELETE'], ['playground', 'POST'],
  ];
  for (const [route, method] of cases) {
    const context = { exports: {}, Response, URL, process: { env: {} }, require: (name) => {
      if (name === '@/lib/errors') return messages;
      return new Proxy({}, { get: () => fault });
    } };
    vm.runInNewContext(source(`../app/api/${route}/route.ts`), context);
    const response = await context.exports[method]({ url: 'http://localhost/api/test', json: fault });
    assert.equal(response.status, 502, route);
    const body = await response.json();
    assert.ok(Object.values(messages.errors).includes(body.error), route);
    assert.doesNotMatch(JSON.stringify(body), /secret-value|ACCESS_TOKEN_INVALID|DNS/);
  }
  const context = { exports: {}, Response, URL, require: (name) => name === '@/lib/errors' ? messages : {
    history: async () => [{ id: '1', body: '', error: raw }, { id: '2', body: 'Hello', error: null }],
  } };
  vm.runInNewContext(source('../app/api/messages/route.ts'), context);
  const response = await context.exports.GET({ url: 'http://localhost/api/messages?contact=test' });
  const body = await response.json();
  assert.equal(body.messages[0].error, messages.errors.reply);
  assert.equal(body.messages[1].body, 'Hello');
  assert.equal(body.messages[1].error, null);
  assert.doesNotMatch(JSON.stringify(body), /secret-value|ACCESS_TOKEN_INVALID|DNS/);
});
