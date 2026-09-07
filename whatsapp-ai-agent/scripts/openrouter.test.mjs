// Run: node --test scripts/openrouter.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const source = ts.transpileModule(
  readFileSync(new URL('../app/api/openrouter/route.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

test('OpenRouter PKCE connects only after a valid exchange; failures preserve settings', async () => {
  const saved = [];
  let exchange;
  let provider = Response.json({ key: 'test-key' });
  const context = {
    exports: {}, URL, Response, AbortSignal,
    require: (name) => name === '@/lib/db'
      ? { saveSettings: async (patch) => saved.push(patch.openrouter_api_key) }
      : require(name),
    fetch: async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/auth/keys');
      exchange = JSON.parse(options.body);
      return provider;
    },
  };
  vm.runInNewContext(source, context);
  const { POST, GET } = context.exports;
  const base = 'http://localhost:3000/api/openrouter';
  assert.equal((await POST(new NextRequest(base, {
    method: 'POST', headers: { origin: 'https://other.example' },
  }))).status, 403);
  const start = await POST(new NextRequest(base, {
    method: 'POST', headers: { origin: 'http://localhost:3000' },
  }));
  const auth = new URL(start.headers.get('location'));
  const cookie = start.cookies.get('openrouter_verifier');
  assert.equal(auth.origin + auth.pathname, 'https://openrouter.ai/auth');
  assert.equal(auth.searchParams.get('callback_url'), base);
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(auth.searchParams.get('code_challenge'),
    createHash('sha256').update(cookie.value).digest('base64url'));
  assert.match(start.headers.get('set-cookie'), /HttpOnly/);
  assert.match(start.headers.get('set-cookie'), /SameSite=lax/i);
  const callback = (query, withCookie = true) => GET(new NextRequest(base + query, {
    headers: withCookie ? { cookie: `${cookie.name}=${cookie.value}` } : {},
  }));
  assert.match((await callback('?code=abc', false)).headers.get('location'), /openrouter=error/);
  assert.match((await callback('?error=access_denied')).headers.get('location'), /openrouter=error/);
  assert.equal(exchange, undefined);
  const success = await callback('?code=abc');
  assert.match(success.headers.get('location'), /openrouter=connected/);
  assert.deepEqual(saved, ['test-key']);
  assert.deepEqual(exchange, { code: 'abc', code_verifier: cookie.value, code_challenge_method: 'S256' });
  assert.match(success.headers.get('set-cookie'), /Max-Age=0/);
  for (const response of [new Response('', { status: 403 }), Response.json({ key: '' })]) {
    provider = response;
    assert.match((await callback('?code=bad')).headers.get('location'), /openrouter=error/);
  }
  context.fetch = async () => { throw new Error('Network failure'); };
  assert.match((await callback('?code=abc')).headers.get('location'), /openrouter=error/);
  assert.deepEqual(saved, ['test-key']);
});
