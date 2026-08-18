import { getSettings } from './db';

const API = process.env.HOOKMYAPP_API_URL ?? 'https://api.hookmyapp.com';

/** Keys come from the settings page first, environment second. */
async function headers(): Promise<Record<string, string>> {
  const s = await getSettings();
  const key = s.hookmyapp_api_key ?? process.env.HOOKMYAPP_API_KEY;
  if (!key) throw new Error('Add your HookMyApp API key in Settings');
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const ws = s.hookmyapp_workspace_id ?? process.env.HOOKMYAPP_WORKSPACE_ID;
  if (ws) h['X-Workspace-Id'] = ws;
  return h;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: await headers(), cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HookMyApp ${init.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Public URL of this deployment, used as the webhook destination. */
export function selfUrl(): string {
  const explicit = process.env.PUBLIC_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (!host) throw new Error('Cannot determine the public URL. Set PUBLIC_URL.');
  return `https://${host}`;
}

export const webhookUrl = () => `${selfUrl()}/api/webhook/whatsapp`;

export type Channel = {
  publicId: string;
  channelType: string;
  displayName?: string;
  phoneNumber?: string;
  status?: string;
};

export async function listChannels(): Promise<Channel[]> {
  const dto = await call<{ channels?: Channel[] } | Channel[]>('/meta/channels');
  const all = Array.isArray(dto) ? dto : (dto.channels ?? []);
  return all.filter((c) => c.channelType === 'whatsapp');
}

export type ChannelCreds = {
  apiBase: string;
  phoneNumberId: string;
  token: string;
  hmacSecret: string;
  verifyToken: string;
};

/** One call returns everything needed to verify inbound and send outbound. */
export async function channelCredentials(channelId: string): Promise<ChannelCreds> {
  const dto = await call<{ values: Record<string, string>; defaults?: Record<string, string> }>(
    `/meta/channels/${channelId}/env`,
  );
  const v = { ...(dto.defaults ?? {}), ...dto.values };
  return {
    apiBase: v.META_GRAPH_API_URL ?? v.WHATSAPP_API_URL,
    phoneNumberId: v.WHATSAPP_PHONE_NUMBER_ID,
    token: v.WHATSAPP_ACCESS_TOKEN,
    hmacSecret: v.WEBHOOK_HMAC_SECRET,
    verifyToken: v.VERIFY_TOKEN,
  };
}

export async function getWebhookConfig(channelId: string) {
  return call<{ webhookUrl: string | null; verifyToken?: string }>(`/webhook-config/${channelId}`);
}

export async function setWebhook(channelId: string, url: string, verifyToken: string) {
  return call(`/webhook-config/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ webhookUrl: url, verifyToken }),
  });
}

export async function createOnboardingLink(label: string, notifyUrl: string) {
  return call<{ url: string; publicId: string }>('/org/onboarding-links', {
    method: 'POST',
    body: JSON.stringify({ label, channelType: 'whatsapp', connectedNotificationUrl: notifyUrl }),
  });
}

export type SandboxSession = {
  id: string;
  type: string;
  hmacSecret: string;
  verifyToken: string;
  accessToken: string;
  whatsappPhone: string;
  whatsappApiVersion: string;
  webhookUrl?: string | null;
};

const SANDBOX_BASE =
  process.env.HOOKMYAPP_SANDBOX_URL ?? 'https://sandbox.hookmyapp.com';

export async function activeSandboxSession(): Promise<SandboxSession | null> {
  const dto = await call<{ sessions?: SandboxSession[] } | SandboxSession[]>(
    '/sandbox/sessions?active=true',
  );
  const list = Array.isArray(dto) ? dto : (dto.sessions ?? []);
  return list.find((s) => s.type === 'whatsapp') ?? null;
}

export async function bindCode() {
  return call<{ code: string; phoneNumber?: string; expiresAt?: string }>('/sandbox/bind-code');
}

export function sandboxCredentials(s: SandboxSession): ChannelCreds {
  return {
    apiBase: `${SANDBOX_BASE.replace(/\/$/, '')}/${s.whatsappApiVersion}`,
    phoneNumberId: s.whatsappPhone,
    token: s.accessToken,
    hmacSecret: s.hmacSecret,
    verifyToken: s.verifyToken,
  };
}

export async function setSandboxWebhook(sessionId: string, url: string) {
  return call(`/sandbox/sessions/${sessionId}/webhook-url`, {
    method: 'PATCH',
    body: JSON.stringify({ webhookUrl: url }),
  });
}

export async function resetSandboxWebhook(sessionId: string) {
  return call(`/sandbox/sessions/${sessionId}/reset-webhook`, { method: 'POST' });
}

/** Sends a WhatsApp text through the channel or sandbox gateway. */
export async function sendText(
  creds: Pick<ChannelCreds, 'apiBase' | 'phoneNumberId' | 'token'>,
  to: string,
  body: string,
): Promise<void> {
  const res = await fetch(`${creds.apiBase.replace(/\/$/, '')}/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) throw new Error(`Send failed (${res.status}): ${await res.text()}`);
}
