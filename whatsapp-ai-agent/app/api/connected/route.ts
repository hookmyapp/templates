import { channelCredentials, setWebhook, webhookUrl } from '@/lib/hookmyapp';
import { saveSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Called by HookMyApp when a number finishes connecting through the link. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    channelId?: string;
    channel?: { publicId?: string };
  };
  const channelId = body.channelId ?? body.channel?.publicId;
  if (!channelId) return Response.json({ error: 'no channel id in payload' }, { status: 400 });

  const creds = await channelCredentials(channelId);
  await setWebhook(channelId, webhookUrl(), creds.verifyToken);
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
  return Response.json({ ok: true });
}
