import { errors, reportError } from './errors';
import type { Message } from './db';

const URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Turns stored history into a reply. Throws if OpenRouter rejects the call. */
export async function reply(
  systemPrompt: string,
  model: string,
  past: Message[],
  incoming: string,
  apiKey?: string | null,
  temperature = 0.7,
): Promise<string> {
  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error(errors.openrouterKey);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...past.filter((m) => !m.error && m.body).map((m) => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.body,
    })),
    { role: 'user', content: incoming },
  ];

  const res = await fetch(URL, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // ponytail: cap short replies at 1,024 tokens; expose a setting if longer replies are needed.
    body: JSON.stringify({ model, messages, temperature, max_completion_tokens: 1024 }),
  });
  if (!res.ok) {
    reportError('openrouter', { status: res.status });
    const message = res.status === 401 ? errors.openrouterAuth
      : res.status === 402 ? errors.openrouterCredits
      : res.status === 429 ? errors.openrouterBusy : errors.openrouterReply;
    throw new Error(message);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(errors.openrouterReply);
  return text;
}
