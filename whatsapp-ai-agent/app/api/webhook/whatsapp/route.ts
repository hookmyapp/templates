import { after, NextRequest } from 'next/server';
import { addMessage, getSettings, history } from '@/lib/db';
import { sendText } from '@/lib/hookmyapp';
import { reply } from '@/lib/llm';
import { parseInbound, verifySignature } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

/** Ownership probe. Echoes the challenge when the verify token matches. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const settings = await getSettings();
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === settings.verify_token) {
    return new Response(q.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const settings = await getSettings();

  if (!settings.hmac_secret) {
    return new Response('Not connected yet', { status: 503 });
  }
  if (!verifySignature(raw, req.headers.get('x-hookmyapp-signature-256'), settings.hmac_secret)) {
    return new Response('Bad signature', { status: 401 });
  }

  const inbound = parseInbound(JSON.parse(raw));

  // Acknowledge first, answer after. The LLM call is far slower than the
  // window HookMyApp waits for a 200.
  after(async () => {
    for (const msg of inbound) {
      await addMessage({ contact: msg.from, direction: 'in', body: msg.text });
      try {
        const past = await history(msg.from);
        const answer = await reply(
          settings.system_prompt,
          settings.model,
          past.slice(0, -1),
          msg.text,
          settings.openrouter_api_key,
        );
        await sendText(
          {
            apiBase: settings.api_base!,
            phoneNumberId: settings.phone_number_id!,
            token: settings.channel_token!,
          },
          msg.from,
          answer,
        );
        await addMessage({ contact: msg.from, direction: 'out', body: answer });
      } catch (err) {
        // Nothing surfaces a throw after the response, so the failure is
        // stored and shown in the chat view instead of vanishing.
        await addMessage({
          contact: msg.from,
          direction: 'out',
          body: '',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  return new Response('ok', { status: 200 });
}
