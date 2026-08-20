#!/usr/bin/env node
// Gets a HookMyApp key over email and writes it into .env.local.
// Interactive:     npm run connect
// Non-interactive: npm run connect -- --email you@example.com
//                  npm run connect -- --email you@example.com --registration-id <id> --otp 123456
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';

const API = process.env.HOOKMYAPP_API_URL ?? 'https://api.hookmyapp.com';
const ENV_FILE = path.join(process.cwd(), '.env.local');
const SCOPES = [
  'workspace.read',
  'channel.connect',
  'channel.read',
  'channel.manage',
  'messages.read',
];

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function die(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function api(pathname, body, token) {
  const res = await fetch(`${API}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    die(`HookMyApp said ${res.status}: ${message ?? text}`);
  }
  return data;
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** Rewrites the keys we own and leaves every other line untouched. */
async function writeEnv(values) {
  const existing = existsSync(ENV_FILE) ? await readFile(ENV_FILE, 'utf8') : '';
  const lines = existing.split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  for (const [key, value] of Object.entries(values)) {
    const at = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (at === -1) lines.push(`${key}=${value}`);
    else lines[at] = `${key}=${value}`;
  }
  await writeFile(ENV_FILE, `${lines.join('\n')}\n`);
}

const interactive = process.stdin.isTTY && !flag('otp');
const email = flag('email') ?? (interactive ? await ask('Email for your HookMyApp account: ') : null);
if (!email) die('Pass --email you@example.com');

let registrationId = flag('registration-id');
if (!registrationId) {
  const claim = await api('/agent/auth/claim', { email, scopes: SCOPES });
  registrationId = claim.registrationId;
  console.log(`\nA 6-digit code is on its way to ${email}.`);
  if (!interactive) {
    console.log(
      `\nFinish with:\n  npm run connect -- --email ${email} --registration-id ${registrationId} --otp <code>\n`,
    );
    process.exit(0);
  }
}

const otp = flag('otp') ?? (await ask('Paste the 6-digit code: '));
if (!/^\d{6}$/.test(otp)) die('That is not a 6-digit code.');

const credential = await api('/agent/auth/claim/complete', { registrationId, otp });

const workspaces = await api('/workspaces', undefined, credential.accessToken);
const list = Array.isArray(workspaces) ? workspaces : (workspaces.workspaces ?? []);
if (list.length === 0) die('That account has no workspace yet. Create one at app.hookmyapp.com.');

let workspace = list[0];
if (list.length > 1 && interactive) {
  console.log('\nWorkspaces:');
  list.forEach((w, i) => console.log(`  ${i + 1}. ${w.name ?? w.publicId} (${w.publicId})`));
  const pick = Number(await ask('Which one? ')) || 1;
  workspace = list[pick - 1] ?? list[0];
}

await writeEnv({
  HOOKMYAPP_API_KEY: credential.accessToken,
  HOOKMYAPP_WORKSPACE_ID: workspace.publicId,
});

console.log(`\nSaved to .env.local`);
console.log(`  HOOKMYAPP_API_KEY      ${credential.accessToken.slice(0, 9)}...`);
console.log(`  HOOKMYAPP_WORKSPACE_ID ${workspace.publicId}`);
console.log(`\nRestart the dev server to pick it up.\n`);
