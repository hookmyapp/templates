import { errors, publicError, reportError } from './errors';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { getSettings } from './db';
import { selfUrl } from './hookmyapp';

export type TunnelState = {
  running: boolean;
  starting: boolean;
  detail: string | null;
  target: string | null;
  address: string | null;
  error: string | null;
};

type Tunnel = { child: ChildProcess; configDir: string; selection: string; closed?: boolean } & TunnelState;
const store = globalThis as unknown as { __tunnel?: Tunnel; __tunnelExitHooked?: boolean; __receiverChanging?: boolean; __receiverError?: string };

if (!store.__tunnelExitHooked) {
  store.__tunnelExitHooked = true;
  for (const signal of ['exit', 'SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      if (store.__tunnel) terminate(store.__tunnel.child);
    });
  }
}

/** Windows signals do not run the CLI's cleanup handlers; stop its children too. */
function terminate(child: ChildProcess): boolean {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  if (process.platform !== 'win32') return child.kill();
  if (!child.pid) return false;
  const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
    windowsHide: true, stdio: 'ignore', timeout: 5000,
  });
  return result.status === 0;
}

function cliEntry(): string {
  const require_ = createRequire(path.join(process.cwd(), 'package.json'));
  const manifest = require_.resolve('@gethookmyapp/cli/package.json');
  const bin = require_('@gethookmyapp/cli/package.json').bin as Record<string, string>;
  return path.join(path.dirname(manifest), bin.hookmyapp);
}

export function status(): TunnelState {
  const t = store.__tunnel;
  return {
    running: t?.running ?? false, starting: !t?.running && Boolean(t?.starting || store.__receiverChanging),
    detail: t?.detail ?? (store.__receiverChanging && !t?.running ? 'Preparing the selected number…' : null),
    target: t?.target ?? null, address: t?.address ?? null, error: (t?.error ?? store.__receiverError) ? publicError(t?.error ?? store.__receiverError, errors.connect) : null,
  };
}

export async function stop(): Promise<void> {
  store.__receiverError = undefined;
  const t = store.__tunnel;
  if (!t) return;
  t.running = false;
  t.starting = false;
  if (!t.closed && t.child.exitCode === null && t.child.signalCode === null) {
    // Wait for CLI cleanup before another listener can claim the same number.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(errors.stopping)), 15_000);
      t.child.once('exit', () => { clearTimeout(timeout); resolve(); });
      if (!terminate(t.child)) {
        clearTimeout(timeout);
        reject(new Error(errors.stopping));
      }
    });
  }
  if (t.configDir) rmSync(t.configDir, { recursive: true, force: true });
  if (store.__tunnel === t) store.__tunnel = undefined;
}

/** Serialize selection + startup so two tabs cannot mix accounts or numbers. */
export async function receiveHere(configure: () => Promise<boolean>): Promise<TunnelState | null> {
  if (store.__receiverChanging) throw new Error(errors.connecting);
  store.__receiverChanging = true;
  try {
    await stop();
    const reachable = await configure();
    return reachable ? null : await start();
  } catch (err) {
    reportError('receiver', err);
    store.__receiverError = publicError(err, errors.connect);
    throw err;
  } finally {
    store.__receiverChanging = false;
  }
}

/** Use the app's account, workspace and selected number, never the user's CLI login. */
export async function start(): Promise<TunnelState> {
  if (process.env.NODE_ENV === 'production') throw new Error('A deployment receives messages directly.');
  if (store.__tunnel?.starting) throw new Error(errors.connecting);
  const settings = await getSettings();
  const key = settings.hookmyapp_api_key ?? process.env.HOOKMYAPP_API_KEY;
  const workspace = settings.hookmyapp_workspace_id ?? process.env.HOOKMYAPP_WORKSPACE_ID;
  const channel = settings.mode === 'live' ? settings.channel_id : null;
  const session = settings.mode === 'sandbox' ? settings.sandbox_session_id : null;
  if (!key || !workspace) throw new Error(errors.setup);
  if (!settings.hmac_secret || !settings.verify_token) throw new Error(errors.number);
  if (channel ? !/^ch_[A-Za-z0-9]+$/.test(channel) : !session || !/^ssn_[A-Za-z0-9]+$/.test(session)) {
    throw new Error(errors.number);
  }
  const localUrl = new URL(await selfUrl());
  const port = Number(localUrl.port || (localUrl.protocol === 'https:' ? 443 : 80));
  const selection = `${workspace}:${channel ?? session}:${port}`;
  if (store.__tunnel?.running && store.__tunnel.selection === selection) return status();
  // ponytail: this CLI migrates legacy credentials even with a config override.
  // Refuse that case until the CLI supports migration-free embedded auth.
  if (existsSync(path.join(homedir(), '.hookmyapp', 'credentials.json'))) {
    throw new Error(errors.installation);
  }
  await stop();
  const configDir = mkdtempSync(path.join(tmpdir(), 'whatsapp-agent-'));
  let child: ChildProcess;
  try {
    writeFileSync(path.join(configDir, 'credentials.json'), JSON.stringify({
      kind: 'agent', accessToken: key, refreshToken: '', expiresAt: 0,
    }), { mode: 0o600 });
    writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ activeWorkspaceId: workspace }), { mode: 0o600 });
    const args = channel ? ['channels', 'listen', channel] : ['sandbox', 'listen', '--session', session!];
    child = spawn(process.execPath, [cliEntry(), ...args, '--port', String(port), '--path', '/api/webhook/whatsapp'], {
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, HOOKMYAPP_CONFIG_DIR: configDir, HOOKMYAPP_API_URL: process.env.HOOKMYAPP_API_URL ?? 'https://api.hookmyapp.com', HOOKMYAPP_TELEMETRY: 'off' },
    });
  } catch (err) {
    rmSync(configDir, { recursive: true, force: true });
    throw err;
  }
  const tunnel: Tunnel = {
    child, configDir, selection, running: false, starting: true,
    detail: 'Starting the message receiver…',
    target: channel ? 'your number' : 'the sandbox number', address: null, error: null,
  };
  store.__tunnel = tunnel;
  let output = '';
  const read = (chunk: Buffer) => {
    // Keep a bounded tail; CLI output can contain credentials, so never echo it.
    output = (output + chunk.toString()).slice(-8192);
    const found = output.match(/tunnel active:\s*(https:\/\/\S+)/i);
    if (found && !tunnel.address) {
      tunnel.address = found[1];
      tunnel.detail = 'Checking that messages can reach this app…';
    }
    if (/AUTH_REQUIRED|session expired|not logged in|unauthori[sz]ed/i.test(output)) {
      tunnel.error = errors.hookAuth;
    } else {
      const code = output.match(/\(([A-Z][A-Z0-9_]+)\)/)?.[1];
      if (code) {
        reportError('receiver', { code });
        tunnel.error = errors.connect;
      }
    }
  };
  child.stdout?.on('data', read);
  child.stderr?.on('data', read);
  child.on('error', () => {
    tunnel.closed = true;
    tunnel.starting = false;
    tunnel.running = false;
    tunnel.error = errors.connect;
  });
  child.on('exit', () => {
    tunnel.closed = true;
    tunnel.starting = false;
    tunnel.running = false;
    tunnel.error ??= errors.stopped;
    rmSync(configDir, { recursive: true, force: true });
  });

  // The public tunnel is protected by Cloudflare Access: only HookMyApp's
  // forwarder can call it. After the CLI configures the tunnel and binds its
  // proxy, verify our local webhook instead. Never gate startup on public DNS.
  const body = JSON.stringify({ entry: [], probe: randomUUID() });
  const signature = `sha256=${createHmac('sha256', settings.hmac_secret).update(body).digest('hex')}`;
  const deadline = Date.now() + 60_000;
  let probeFailure = 'The CLI did not finish configuring the receiver.';
  while (store.__tunnel === tunnel && tunnel.starting && !tunnel.error && Date.now() < deadline) {
    if (tunnel.address) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/webhook/whatsapp`, {
          method: 'POST', body, headers: { 'Content-Type': 'application/json', 'x-hookmyapp-signature-256': signature },
          signal: AbortSignal.timeout(3000), redirect: 'error', cache: 'no-store',
        });
        const delivered = response.ok && await response.text() === 'ok';
        if (delivered && tunnel.starting && !tunnel.error && store.__tunnel === tunnel) {
          tunnel.running = true;
          tunnel.starting = false;
          tunnel.detail = null;
          return status();
        }
        probeFailure = `Local webhook returned HTTP ${response.status} without confirming delivery.`;
      } catch {
        probeFailure = 'The local webhook could not be reached.';
      }
      tunnel.detail = 'Still connecting. This may take a moment…';
    }
    await delay(500);
  }
  if (!tunnel.error) console.error('[receiver] Connection timed out:', probeFailure);
  const error = tunnel.error ?? errors.connect;
  if (store.__tunnel === tunnel) await stop();
  store.__receiverError = error;
  throw new Error(error);
}
