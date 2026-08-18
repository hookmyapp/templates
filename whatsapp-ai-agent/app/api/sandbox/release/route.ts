import { resetSandboxWebhook } from '@/lib/hookmyapp';
import { getSettings, saveSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Hands the sandbox session back so local tools can receive it again. */
export async function POST() {
  const settings = await getSettings();
  if (!settings.sandbox_session_id) return Response.json({ ok: true });
  try {
    await resetSandboxWebhook(settings.sandbox_session_id);
    await saveSettings({ sandbox_session_id: null, hmac_secret: null });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
