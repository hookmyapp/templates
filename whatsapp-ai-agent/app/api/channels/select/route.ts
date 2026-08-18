import { channelCredentials, setWebhook, webhookUrl } from '@/lib/hookmyapp';
import { saveSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { channelId } = (await req.json()) as { channelId: string };
  try {
    const creds = await channelCredentials(channelId);
    await setWebhook(channelId, webhookUrl(), creds.verifyToken);
    const settings = await saveSettings({
      mode: 'live',
      channel_id: channelId,
      sandbox_session_id: null,
      api_base: creds.apiBase,
      phone_number_id: creds.phoneNumberId,
      channel_token: creds.token,
      hmac_secret: creds.hmacSecret,
      verify_token: creds.verifyToken,
    });
    return Response.json({ ok: true, mode: settings.mode, webhookUrl: webhookUrl() });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
