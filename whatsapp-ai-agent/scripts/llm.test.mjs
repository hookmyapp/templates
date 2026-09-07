import { loadErrors } from './test-utils.mjs';
// Run: node --test scripts/llm.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('replies fit a small token budget and provider errors stay readable', async () => {
  let response = Response.json({ choices: [{ message: { content: ' Yes, I am here. ' } }] });
  const context = {
    exports: {}, AbortSignal, require: () => loadErrors(),
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.max_completion_tokens, 1024);
      assert.equal(body.messages.at(-1).content, 'you working?');
      return response;
    },
  };
  vm.runInNewContext(ts.transpileModule(
    readFileSync(new URL('../lib/llm.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText, context);
  const reply = () => context.exports.reply('Keep replies short.', 'test-model', [], 'you working?', 'test-key');
  assert.equal(await reply(), 'Yes, I am here.');
  for (const [status, expected] of [[402, /credit limit was reached/], [401, /rejected your key/], [429, /too many requests/], [500, /model could not answer/]]) {
    response = Response.json({ error: { message: 'raw-provider-details', metadata: { previous_errors: [] } }, user_id: 'private-user-id' }, { status });
    await assert.rejects(reply, (error) => {
      assert.match(error.message, expected);
      assert.ok(error.message.length < 220);
      assert.doesNotMatch(error.message, /raw-provider-details|private-user-id|previous_errors/);
      return true;
    });
  }
});
