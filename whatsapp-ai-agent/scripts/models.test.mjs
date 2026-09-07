import { loadErrors } from './test-utils.mjs';
// Run: node --test scripts/models.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('model access follows balance, falls back to key metadata, and excludes charged or non-text models', async () => {
  let key = 'test-key';
  let account = { is_free_tier: true, limit_remaining: null };
  let credits = { total_credits: 0, total_usage: 0 };
  let authStatus = 200;
  const context = {
    exports: {}, Response, AbortSignal, process: { env: {} },
    require: (name) => name.endsWith('/errors') ? loadErrors() : ({ getSettings: async () => ({ openrouter_api_key: key }) }),
    fetch: async (url) => {
      if (url.endsWith('/key')) return Response.json({ data: account }, { status: authStatus });
      if (url.endsWith('/credits')) return Response.json({ data: credits }, { status: credits ? 200 : 403 });
      assert.ok(url.endsWith('/models'));
      return Response.json({ data: [
        { id: 'free', pricing: { prompt: '0', completion: '0.000', request: '0' } },
        { id: 'paid', pricing: { prompt: '0.001', completion: '0.001' } },
        { id: 'request-fee', pricing: { prompt: '0', completion: '0', request: '0.01' } },
        { id: 'unknown-price' },
        { id: 'audio', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['audio'] } },
      ] });
    },
  };
  vm.runInNewContext(ts.transpileModule(
    readFileSync(new URL('../app/api/models/route.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, context);
  const load = async () => (await context.exports.GET()).json();
  let result = await load();
  assert.equal(result.freeOnly, true);
  assert.deepEqual(result.models.map(m => m.id), ['free']);
  account.is_free_tier = false;
  assert.equal((await load()).freeOnly, true); // A formerly paid account can run out.
  credits = { total_credits: 10, total_usage: 2 };
  result = await load();
  assert.equal(result.freeOnly, false);
  assert.ok(result.models.some(m => m.id === 'paid'));
  assert.ok(!result.models.some(m => m.id === 'audio'));
  account.is_free_tier = true;
  assert.equal((await load()).freeOnly, false); // Positive balance beats tier metadata.
  account.limit_remaining = 0;
  assert.equal((await load()).freeOnly, true);
  account.limit_remaining = null;
  credits = null;
  result = await load();
  assert.equal(result.balanceKnown, false);
  assert.equal(result.freeOnly, true);
  account.is_free_tier = false;
  assert.equal((await load()).freeOnly, false); // An unreadable balance is not zero.
  authStatus = 401;
  assert.equal((await load()).connected, false);
  key = null;
  assert.equal((await load()).connected, false);
});
