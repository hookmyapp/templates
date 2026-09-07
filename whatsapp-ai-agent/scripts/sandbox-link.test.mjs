import { loadErrors } from './test-utils.mjs';
// Run: node --test scripts/sandbox-link.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('sandbox link includes the correct destination and encoded code', async () => {
  const source = ts.transpileModule(
    readFileSync(new URL('../lib/hookmyapp.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const load = (env = {}) => {
    const context = {
      exports: {}, URL, AbortSignal, process: { env },
      require: (name) => name === './errors' ? loadErrors() : ({ getSettings: async () => ({ hookmyapp_api_key: 'test-key' }) }),
      fetch: async () => Response.json({ code: 'test +&code', issuedAt: '2026-09-07' }),
    };
    vm.runInNewContext(source, context);
    const creds = context.exports.sandboxCredentials({ whatsappPhone: '15551112222', sandboxPhoneNumberId: 'sandbox-id', whatsappApiVersion: 'v25.0', accessToken: 'test-token', hmacSecret: 'test-hmac', verifyToken: 'test-verify' });
    assert.equal(creds.phoneNumberId, 'sandbox-id');
    assert.equal(creds.apiBase, 'https://sandbox.hookmyapp.com/v25.0');
    return context.exports.bindCode();
  };
  const bind = await load();
  assert.equal(bind.phoneNumber, '+17372370900');
  assert.equal(new URL(bind.whatsappUrl).pathname, '/17372370900');
  assert.equal(new URL(bind.whatsappUrl).searchParams.get('text'), bind.code);
  const staging = await load({ HOOKMYAPP_API_URL: 'https://staging-api.hookmyapp.com', HOOKMYAPP_SANDBOX_PHONE_NUMBER: '+972 55-704-6276' });
  assert.equal(staging.phoneNumber, '+972557046276');
  await assert.rejects(load({ HOOKMYAPP_API_URL: 'http://localhost:4316' }), /Set HOOKMYAPP_SANDBOX_PHONE_NUMBER/);
  await assert.rejects(load({ HOOKMYAPP_SANDBOX_PHONE_NUMBER: 'invalid' }), /Set HOOKMYAPP_SANDBOX_PHONE_NUMBER/);
});
