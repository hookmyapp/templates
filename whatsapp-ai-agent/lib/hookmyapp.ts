import { headers } from 'next/headers';
import { getSettings } from './db';

const API = process.env.HOOKMYAPP_API_URL ?? 'https://api.hookmyapp.com';

/** Keys come from the settings page first, environment second. */
async function authHeaders(): Promise<Record<string, string>> {
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
  const res = await fetch(`${API}${path}`, { ...init, headers: await authHeaders(), cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HookMyApp ${init.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * The address this app is reachable at, taken from the request being served,
 * so any port and any tunnel host work without configuration. PUBLIC_URL
 * overrides it when the app sits behind something that rewrites the host.
 */
export async function selfUrl(): Promise<string> {
  const explicit = process.env.PUBLIC_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const incoming = await headers();
  const host = incoming.get('x-forwarded-host') ?? incoming.get('host');
  if (host) {
    const proto = incoming.get('x-forwarded-proto') ?? (isLocalHost(host) ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  throw new Error('Cannot determine the address of this app. Set PUBLIC_URL.');
}

function isLocalHost(host: string): boolean {
  const name = host.split(':')[0];
  return name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name.endsWith('.local');
}

export async function webhookUrl(): Promise<string> {
  return `${await selfUrl()}/api/webhook/whatsapp`;
}

/** True while this app is only reachable from the machine it runs on. */
export async function isReachableFromOutside(): Promise<boolean> {
  try {
    return !isLocalHost(new URL(await selfUrl()).host);
  } catch {
    return false;
  }
}

export const NO_PUBLIC_URL =
  'This app is only reachable from your own machine, so HookMyApp cannot deliver messages to it. Expose it with a tunnel and open the app on that address.';

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

/** Starts Meta sign-in for a number that lands in your own workspace. */
export async function startConnect(): Promise<{ redirectUrl: string }> {
  return call<{ redirectUrl: string }>('/meta/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ redirectPath: '/cli/callback' }),
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
