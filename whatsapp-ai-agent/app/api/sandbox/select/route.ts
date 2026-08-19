import {
  activeSandboxSession,
  isReachableFromOutside,
  sandboxCredentials,
  setSandboxWebhook,
  webhookUrl,
} from '@/lib/hookmyapp';
import { saveSettings } from '@/lib/db';


export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await activeSandboxSession();
    if (!session) {
      return Response.json(
        { error: 'No active sandbox session. Send the bind code from WhatsApp first.' },
        { status: 409 },
      );
    }
    const creds = sandboxCredentials(session);
    // Only point the session at this app when it is reachable. Running on a
    // laptop, the tunnel started from the Connection card carries the messages.
    const reachable = await isReachableFromOutside();
    if (reachable) await setSandboxWebhook(session.id, await webhookUrl());
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
    return Response.json({ ok: true, needsTunnel: !reachable });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
