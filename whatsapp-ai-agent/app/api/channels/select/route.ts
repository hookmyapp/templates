import { errors, publicError, reportError } from '@/lib/errors';
import { receiveHere } from '@/lib/tunnel';
import {
  channelCredentials,
  isReachableFromOutside,
  setWebhook,
  webhookUrl,
} from '@/lib/hookmyapp';
import { saveSettings } from '@/lib/db';


export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { channelId } = (await req.json()) as { channelId: string };
    const tunnel = await receiveHere(async () => {
      const creds = await channelCredentials(channelId);
      // See the sandbox route: locally the tunnel carries the messages instead.
      const reachable = await isReachableFromOutside();
      if (reachable) await setWebhook(channelId, await webhookUrl(), creds.verifyToken);
      await saveSettings({
        mode: 'live',
        channel_id: channelId,
        sandbox_session_id: null,
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
    reportError('channels', err);
    return Response.json({ error: publicError(err, errors.connect) }, { status: 502 });
  }
}
