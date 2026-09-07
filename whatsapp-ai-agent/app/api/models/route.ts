import { errors, publicError, reportError } from '@/lib/errors';
import { getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Model = {
  id: string;
  name?: string;
  pricing?: Record<string, string>;
  architecture?: { output_modalities?: string[] };
};

/** The model list, only once an OpenRouter key is stored. */
export async function GET() {
  try {
    const s = await getSettings();
    const key = s.openrouter_api_key ?? process.env.OPENROUTER_API_KEY;
    if (!key) return Response.json({ connected: false, models: [] });

    // The public model list answers 200 for any key, so check the key itself first.
    const auth = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!auth.ok) return Response.json({ connected: false, models: [] });
    const { data: account } = (await auth.json()) as {
      data: { is_free_tier: boolean; limit_remaining: number | null };
    };

    const [res, credits] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store', signal: AbortSignal.timeout(15_000),
      }),
      fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store', signal: AbortSignal.timeout(15_000),
      }).catch(() => null),
    ]);
    if (!res.ok) {
      return Response.json({ connected: false, error: errors.openrouterReply }, { status: 502 });
    }
    const balance = credits?.ok ? (await credits.json().catch(() => null))?.data : null;
    const balanceKnown = typeof balance?.total_credits === 'number' && typeof balance?.total_usage === 'number';
    // ponytail: ordinary keys may hide account balance; use free-tier/key-limit signals when unavailable.
    const freeOnly = (account.limit_remaining !== null && account.limit_remaining <= 0)
      || (balanceKnown ? balance.total_credits - balance.total_usage <= 0 : account.is_free_tier);
    const data = (await res.json()) as { data?: Model[] };
    const models = (data.data ?? [])
      .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes('text'))
      .filter((m) => !freeOnly || (
        m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0
        && Object.values(m.pricing).every((price) => Number(price) === 0)
      ))
      .map((m) => ({ id: m.id, name: m.name ?? m.id }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return Response.json({ connected: true, freeOnly, balanceKnown, models });
  } catch (err) {
    reportError('models', err);
    return Response.json({ error: publicError(err, errors.load) }, { status: 502 });
  }
}
