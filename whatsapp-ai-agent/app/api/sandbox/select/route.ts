import { errors, publicError, reportError } from '@/lib/errors';
import { receiveHere } from '@/lib/tunnel';
import {
  activeSandboxSession,
  isReachableFromOutside,
  sandboxCredentials,
  resetSandboxWebhook,
  setSandboxWebhook,
  webhookUrl,
} from '@/lib/hookmyapp';
import { saveSettings } from '@/lib/db';


export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const tunnel = await receiveHere(async () => {
      const session = await activeSandboxSession();
      if (!session) {
        throw new Error(errors.sandbox);
      }
      const creds = sandboxCredentials(session);
      // Deployments receive directly; local apps start a receiver after saving.
      const reachable = await isReachableFromOutside();
      if (reachable) await setSandboxWebhook(session.id, await webhookUrl());
      else if (session.webhookUrl) await resetSandboxWebhook(session.id);
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
      return reachable;
    });
    return Response.json({ ok: true, tunnel });
  } catch (err) {
    reportError('sandbox', err);
    return Response.json({ error: publicError(err, errors.connect) }, { status: 502 });
  }
}
