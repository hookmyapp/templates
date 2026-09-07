/** Only messages owned by this app may reach the UI or conversation history. */
export const errors = {
  request: 'Something went wrong. Please try again.',
  load: 'Could not load this information. Please refresh and try again.',
  save: 'Could not save your changes. Please try again.',
  connect: 'Could not start receiving messages. Please try again.',
  reply: 'Could not answer this message. Please try again.',
  send: 'Could not send the reply. Please try again.',
  hookKey: 'Add your HookMyApp key in Settings to continue.',
  hookAuth: 'HookMyApp could not sign you in. Check your key in Settings.',
  hookAccess: 'This account cannot access the selected number. Check your workspace in Settings.',
  hookMissing: 'This connection is no longer available. Connect your number again.',
  hookBusy: 'HookMyApp is busy. Wait a moment and try again.',
  hookUnavailable: 'HookMyApp is unavailable right now. Please try again shortly.',
  openrouterKey: 'Connect OpenRouter or add your key in Settings to continue.',
  openrouterAuth: 'OpenRouter rejected your key. Reconnect OpenRouter or replace the key in Settings.',
  openrouterCredits: 'Your OpenRouter credit limit was reached. Add credits or choose a free model.',
  openrouterBusy: 'OpenRouter is receiving too many requests. Wait a moment and try again.',
  openrouterReply: 'The model could not answer. Try again or choose another model.',
  connecting: 'Already connecting. Wait a moment.',
  stopping: 'Still stopping. Wait a moment and try again.',
  setup: 'Save your HookMyApp key and workspace in Settings first.',
  number: 'Connect a number first.',
  sandbox: 'Send the connection code to the sandbox number from WhatsApp first.',
  incomplete: 'This connection is incomplete. Connect your number again.',
  stopped: 'Receiving messages stopped. Press Receive messages here to reconnect.',
  installation: 'This installation needs an update before it can receive messages. See the setup guide.',
} as const;

const allowed = new Set<string>(Object.values(errors));

/** Fail closed, including old stored errors and failures from an older server. */
export function publicError(error: unknown, fallback: string = errors.request): string {
  const message = error && typeof error === 'object' && 'message' in error ? error.message : error;
  return typeof message === 'string' && allowed.has(message) ? message : fallback;
}

/** Keep diagnostics useful without logging bodies, credentials, URLs, or command output. */
export function reportError(operation: string, error: unknown): void {
  const detail = error && typeof error === 'object'
    ? error as { name?: unknown; code?: unknown; status?: unknown; requestId?: unknown; cause?: { code?: unknown } }
    : {};
  const safe = (value: unknown) => typeof value === 'string' && /^[\w-]{1,80}$/.test(value) ? value : undefined;
  console.error(`[${operation}] Failed`, {
    type: safe(detail.name), code: safe(detail.code ?? detail.cause?.code),
    status: typeof detail.status === 'number' ? detail.status : undefined,
    requestId: safe(detail.requestId),
  });
}
