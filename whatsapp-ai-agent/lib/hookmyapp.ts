import { errors, reportError } from './errors';
import { headers } from 'next/headers';
import { getSettings } from './db';

const API = process.env.HOOKMYAPP_API_URL ?? 'https://api.hookmyapp.com';

/** Keys come from the settings page first, environment second. */
async function authHeaders(): Promise<Record<string, string>> {
  const s = await getSettings();
  const key = s.hookmyapp_api_key ?? process.env.HOOKMYAPP_API_KEY;
  if (!key) throw new Error(errors.hookKey);
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const ws = s.hookmyapp_workspace_id ?? process.env.HOOKMYAPP_WORKSPACE_ID;
  if (ws) h['X-Workspace-Id'] = ws;
  return h;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: await authHeaders(), cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(15_000) });
  const text = await res.text();
  if (!res.ok) {
    const detail = (() => { try { return JSON.parse(text); } catch { return {}; } })();
    reportError('hookmyapp', { status: res.status, code: detail?.code, requestId: detail?.requestId });
    const message = res.status === 401 ? errors.hookAuth
      : res.status === 403 ? errors.hookAccess
      : res.status === 404 ? errors.hookMissing
      : res.status === 429 ? errors.hookBusy : errors.hookUnavailable;
    throw new Error(message);
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
  const name = new URL(`http://${host}`).hostname;
  return name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local')
    || name === '[::1]' || /^\[(?:f[cd]|fe[89ab])/i.test(name)
    || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(name)
    || name === '0.0.0.0';
}

export async function webhookUrl(): Promise<string> {
  return `${await selfUrl()}/api/webhook/whatsapp`;
}

/** Public URLs can receive directly; local and private-network hosts need a receiver. */
export async function isReachableFromOutside(): Promise<boolean> {
  try {
    return !isLocalHost(new URL(await selfUrl()).host);
  } catch {
    return false;
  }
}

export type Channel = {
  publicId: string;
  channelType: string;
  displayName?: string;
  phoneNumber?: string;
  status?: string;
  webhookUrl?: string | null;
};

export async function listChannels(): Promise<Channel[]> {
  // GET /meta/channels exposes `id` and `type`, unlike the env envelope's channelType.
  const channels = await call<{
    id: string; type: string; whatsappVerifiedName?: string;
    whatsappWabaName?: string; whatsappDisplayPhoneNumber?: string;
    webhookUrl?: string | null;
  }[]>('/meta/channels');
  return channels.filter((c) => c.type === 'whatsapp').map((c) => ({
    publicId: c.id,
    channelType: c.type,
    displayName: c.whatsappVerifiedName ?? c.whatsappWabaName,
    phoneNumber: c.whatsappDisplayPhoneNumber,
    webhookUrl: c.webhookUrl ?? null,
  }));
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
  if (![v.META_GRAPH_API_URL ?? v.WHATSAPP_API_URL, v.WHATSAPP_PHONE_NUMBER_ID, v.WHATSAPP_ACCESS_TOKEN, v.WEBHOOK_HMAC_SECRET, v.VERIFY_TOKEN].every(Boolean)) {
    throw new Error(errors.incomplete);
  }
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
    method: 'PUT',
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
  sandboxPhoneNumberId: string;
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
  const bind = await call<{ code: string; issuedAt: string }>('/sandbox/bind-code');
  // The bind-code API does not return a destination. Match the CLI's production sandbox.
  const configuredPhone = process.env.HOOKMYAPP_SANDBOX_PHONE_NUMBER
    ?? (new URL(API).hostname === 'api.hookmyapp.com' ? '17372370900' : '');
  const phone = configuredPhone.replace(/[\s()+-]/g, '');
  if (!/^[1-9]\d{6,14}$/.test(phone)) {
    throw new Error('Set HOOKMYAPP_SANDBOX_PHONE_NUMBER to the sandbox number for this API environment.');
  }
  return {
    ...bind,
    phoneNumber: `+${phone}`,
    whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(bind.code)}`,
  };
}

export function sandboxCredentials(s: SandboxSession): ChannelCreds {
  if (![s.sandboxPhoneNumberId, s.whatsappApiVersion, s.accessToken, s.hmacSecret, s.verifyToken].every(Boolean)) {
    throw new Error(errors.incomplete);
  }
  return {
    apiBase: `${SANDBOX_BASE.replace(/\/$/, '')}/${s.whatsappApiVersion}`,
    phoneNumberId: s.sandboxPhoneNumberId,
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
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) {
    const failure = await res.json().catch(() => null) as { code?: unknown; requestId?: unknown } | null;
    reportError('whatsapp', { status: res.status, code: failure?.code, requestId: failure?.requestId });
    throw new Error(errors.send);
  }
}
