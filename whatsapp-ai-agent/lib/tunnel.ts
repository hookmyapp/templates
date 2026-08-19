import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

/**
 * Runs the bundled CLI so HookMyApp can reach this app while it is only
 * listening on localhost. Development only: a deployment is already reachable
 * and cannot hold a long lived child process.
 */

export type TunnelState = {
  running: boolean;
  target: string | null;
  address: string | null;
  error: string | null;
};

type Tunnel = { child: ChildProcess } & TunnelState;

// Survives the module reloads the dev server does on every edit.
const store = globalThis as unknown as { __tunnel?: Tunnel; __tunnelExitHooked?: boolean };

// Registered once, not per start, so restarts do not pile up listeners.
if (!store.__tunnelExitHooked) {
  store.__tunnelExitHooked = true;
  for (const signal of ['exit', 'SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => store.__tunnel?.child.kill());
  }
}

const BIN = path.join(process.cwd(), 'node_modules', '.bin', 'hookmyapp');
const ADDRESS = /tunnel active:\s*(https:\/\/\S+)/i;
const LOGGED_OUT = /not logged in|unauthori[sz]ed|\b401\b/i;

/** Turns what the CLI printed into something worth showing in the card. */
function readable(line: string): string {
  if (LOGGED_OUT.test(line)) return 'The CLI is not signed in. Run: npm run hookmyapp -- login';
  if (/NO_ACTIVE_SESSIONS/.test(line)) {
    return 'No sandbox session yet. Send the code above from WhatsApp, then run this again.';
  }
  return line.replace(/^Error:\s*/, '').trim();
}

export function status(): TunnelState {
  const t = store.__tunnel;
  if (!t) return { running: false, target: null, address: null, error: null };
  return { running: t.running, target: t.target, address: t.address, error: t.error };
}

export function stop(): void {
  store.__tunnel?.child.kill();
  store.__tunnel = undefined;
}

/**
 * Starts `sandbox listen` or `channels listen`. The CLI points the message
 * destination at its own tunnel, so nothing here has to know a public URL.
 */
export function start(opts: { channelId?: string; port: number; target: string }): TunnelState {
  if (process.env.NODE_ENV === 'production') {
    return { running: false, target: null, address: null, error: 'Not available in production.' };
  }
  stop();

  const where = ['--port', String(opts.port), '--path', '/api/webhook/whatsapp'];
  const args = opts.channelId
    ? ['channels', 'listen', opts.channelId, ...where]
    : ['sandbox', 'listen', ...where];

  const child = spawn(BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const tunnel: Tunnel = {
    child,
    running: true,
    target: opts.target,
    address: null,
    error: null,
  };
  store.__tunnel = tunnel;

  let lastError: string | null = null;
  const read = (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(text);
    const found = text.match(ADDRESS);
    if (found && !tunnel.address) tunnel.address = found[1];
    for (const line of text.split('\n')) {
      if (/^Error:|failed|not signed in|not logged in/i.test(line)) lastError = readable(line);
    }
  };
  child.stdout?.on('data', read);
  child.stderr?.on('data', read);

  child.on('error', (err) => {
    tunnel.running = false;
    tunnel.error = `Could not start the CLI: ${err.message}`;
  });
  child.on('exit', (code) => {
    tunnel.running = false;
    if (code) tunnel.error = lastError ?? `The tunnel stopped with code ${code}.`;
  });

  return status();
}
