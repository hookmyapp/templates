import { getSettings } from '@/lib/db';
import { reply } from '@/lib/llm';

export const dynamic = 'force-dynamic';

/** Answers with the live prompt without touching WhatsApp or the message log. */
export async function POST(req: Request) {
  const { history, message } = (await req.json()) as {
    history: { direction: 'in' | 'out'; body: string }[];
    message: string;
  };
  const s = await getSettings();
  try {
    const text = await reply(
      s.system_prompt,
      s.model,
      history.map((m, i) => ({
        id: String(i),
        contact_wa_id: 'playground',
        direction: m.direction,
        body: m.body,
        error: null,
        created_at: new Date(0).toISOString(),
      })),
      message,
      s.openrouter_api_key,
      s.temperature,
    );
    return Response.json({ reply: text });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
