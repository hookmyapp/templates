import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verifies the HMAC-SHA256 signature HookMyApp sends with every delivery. */
export function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  const got = header.replace(/^sha256=/, '');
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export type Inbound = { from: string; text: string };

/** Pulls text messages out of a Meta webhook payload. Ignores everything else. */
export function parseInbound(payload: unknown): Inbound[] {
  const out: Inbound[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] }).changes ?? []) {
      const value = (change as { value?: { messages?: unknown[] } }).value;
      for (const msg of value?.messages ?? []) {
        const m = msg as { from?: string; type?: string; text?: { body?: string } };
        if (m.type === 'text' && m.from && m.text?.body) {
          out.push({ from: m.from, text: m.text.body });
        }
      }
    }
  }
  return out;
}
