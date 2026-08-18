import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { parseInbound, verifySignature } from '../lib/whatsapp.ts';

const SECRET = 'test-secret';
const sign = (raw: string) => 'sha256=' + createHmac('sha256', SECRET).update(raw).digest('hex');

const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              { from: '15551234567', type: 'text', text: { body: 'hello there' } },
              { from: '15551234567', type: 'image', image: { id: '1' } },
            ],
          },
        },
      ],
    },
  ],
});

test('a correctly signed body verifies', () => {
  assert.equal(verifySignature(payload, sign(payload), SECRET), true);
});

test('a tampered body does not verify', () => {
  const tampered = payload.replace('hello there', 'hello world');
  assert.equal(verifySignature(tampered, sign(payload), SECRET), false);
});

test('a missing signature does not verify', () => {
  assert.equal(verifySignature(payload, null, SECRET), false);
});

test('a signature of the wrong length does not verify', () => {
  assert.equal(verifySignature(payload, 'sha256=abc', SECRET), false);
});

test('text messages are parsed and other types ignored', () => {
  assert.deepEqual(parseInbound(JSON.parse(payload)), [
    { from: '15551234567', text: 'hello there' },
  ]);
});

test('an unrelated payload yields nothing', () => {
  assert.deepEqual(parseInbound({ entry: [{ changes: [{ value: { statuses: [] } }] }] }), []);
});
