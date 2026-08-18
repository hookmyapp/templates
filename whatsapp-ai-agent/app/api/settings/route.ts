import { getSettings, saveSettings } from '@/lib/db';
import { isReachableFromOutside, webhookUrl } from '@/lib/hookmyapp';

const mask = (v: string | null | undefined) => (v ? `${v.slice(0, 6)}...${v.slice(-4)}` : null);

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSettings();
  let url: string | null = null;
  let reachable = false;
  try {
    url = await webhookUrl();
    reachable = await isReachableFromOutside();
  } catch {
    url = null;
  }
  return Response.json({
    systemPrompt: s.system_prompt,
    model: s.model,
    temperature: s.temperature,
    mode: s.mode,
    connected: Boolean(s.hmac_secret),
    channelId: s.channel_id,
    sandboxSessionId: s.sandbox_session_id,
    phoneNumberId: s.phone_number_id,
    webhookUrl: url,
    reachable,
    keys: {
      hookmyapp: mask(s.hookmyapp_api_key ?? process.env.HOOKMYAPP_API_KEY),
      workspace: s.hookmyapp_workspace_id ?? process.env.HOOKMYAPP_WORKSPACE_ID ?? null,
      openrouter: mask(s.openrouter_api_key ?? process.env.OPENROUTER_API_KEY),
    },
  });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    hookmyappApiKey?: string;
    hookmyappWorkspaceId?: string;
    openrouterApiKey?: string;
  };
  await saveSettings({
    system_prompt: body.systemPrompt,
    model: body.model,
    temperature: body.temperature,
    // Blank means leave the stored value alone.
    hookmyapp_api_key: body.hookmyappApiKey || undefined,
    hookmyapp_workspace_id: body.hookmyappWorkspaceId || undefined,
    openrouter_api_key: body.openrouterApiKey || undefined,
  });
  return Response.json({ ok: true });
}
