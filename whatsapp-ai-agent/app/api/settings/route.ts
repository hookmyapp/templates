import { getSettings, saveSettings } from '@/lib/db';
import { webhookUrl } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSettings();
  let url: string | null = null;
  try {
    url = webhookUrl();
  } catch {
    url = null;
  }
  return Response.json({
    systemPrompt: s.system_prompt,
    model: s.model,
    mode: s.mode,
    connected: Boolean(s.hmac_secret),
    channelId: s.channel_id,
    sandboxSessionId: s.sandbox_session_id,
    phoneNumberId: s.phone_number_id,
    webhookUrl: url,
  });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { systemPrompt?: string; model?: string };
  const s = await saveSettings({
    system_prompt: body.systemPrompt,
    model: body.model,
  });
  return Response.json({ systemPrompt: s.system_prompt, model: s.model });
}
