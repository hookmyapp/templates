import { activeSandboxSession, sandboxCredentials, setSandboxWebhook, webhookUrl } from '@/lib/hookmyapp';
import { saveSettings } from '@/lib/db';
import { NO_PUBLIC_URL, webhookUrlOrNull } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!webhookUrlOrNull()) {
    return Response.json({ error: NO_PUBLIC_URL }, { status: 409 });
  }
  try {
    const session = await activeSandboxSession();
    if (!session) {
      return Response.json(
        { error: 'No active sandbox session. Send the bind code from WhatsApp first.' },
        { status: 409 },
      );
    }
    const creds = sandboxCredentials(session);
    await setSandboxWebhook(session.id, webhookUrl());
    await saveSettings({
      mode: 'sandbox',
      sandbox_session_id: session.id,
      channel_id: null,
      api_base: creds.apiBase,
      phone_number_id: creds.phoneNumberId,
      channel_token: creds.token,
      hmac_secret: creds.hmacSecret,
      verify_token: creds.verifyToken,
    });
    return Response.json({ ok: true, webhookUrl: webhookUrl() });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
