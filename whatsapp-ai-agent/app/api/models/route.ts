import { getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Model = { id: string; name?: string };

/** The model list, only once an OpenRouter key is stored. */
export async function GET() {
  const s = await getSettings();
  const key = s.openrouter_api_key ?? process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ connected: false, models: [] });

  // The public model list answers 200 for any key, so check the key itself first.
  const auth = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!auth.ok) return Response.json({ connected: false, models: [] });

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return Response.json({ connected: false, error: `OpenRouter said ${res.status}` }, { status: 502 });
  }
  const data = (await res.json()) as { data?: Model[] };
  const models = (data.data ?? [])
    .map((m) => ({ id: m.id, name: m.name ?? m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return Response.json({ connected: true, models });
}
