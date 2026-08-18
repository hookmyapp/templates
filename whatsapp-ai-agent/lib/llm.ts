import type { Message } from './db';

const URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Turns stored history into a reply. Throws if OpenRouter rejects the call. */
export async function reply(
  systemPrompt: string,
  model: string,
  past: Message[],
  incoming: string,
  apiKey?: string | null,
): Promise<string> {
  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('Add your OpenRouter key in Settings');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...past.map((m) => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.body,
    })),
    { role: 'user', content: incoming },
  ];

  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw new Error(`OpenRouter failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned an empty reply');
  return text;
}
