import { neon, neonConfig } from '@neondatabase/serverless';
// local only, not committed: the docker proxy speaks http, Neon cloud speaks https
neonConfig.fetchEndpoint = (h, p) => `http://${h}:${p}/sql`;

let client: ReturnType<typeof neon> | null = null;

/** Lazy so a missing DATABASE_URL fails at request time, not at build time. */
export function sql(...args: Parameters<ReturnType<typeof neon>>) {
  client ??= neon(process.env.DATABASE_URL!);
  return client(...args);
}

export type Mode = 'sandbox' | 'live';

export type Settings = {
  system_prompt: string;
  model: string;
  mode: Mode;
  api_base: string | null;
  channel_id: string | null;
  sandbox_session_id: string | null;
  phone_number_id: string | null;
  channel_token: string | null;
  hmac_secret: string | null;
  verify_token: string | null;
  hookmyapp_api_key: string | null;
  hookmyapp_workspace_id: string | null;
  openrouter_api_key: string | null;
};

export type Message = {
  id: number;
  contact_wa_id: string;
  direction: 'in' | 'out';
  body: string;
  error: string | null;
  created_at: string;
};

const DEFAULT_PROMPT =
  'You answer WhatsApp messages for a small business. Keep replies short, friendly and useful. If you do not know something, say so and offer to pass the question on.';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-5';

let ready: Promise<void> | null = null;

/** Creates the two tables and the default settings row on first use. */
export function init(): Promise<void> {
  ready ??= (async () => {
    await sql`
      create table if not exists settings (
        id int primary key default 1,
        system_prompt text not null,
        model text not null,
        mode text not null default 'sandbox',
        api_base text,
        channel_id text,
        sandbox_session_id text,
        phone_number_id text,
        channel_token text,
        hmac_secret text,
        verify_token text,
        updated_at timestamptz not null default now()
      )`;
    await sql`
      create table if not exists messages (
        id bigserial primary key,
        contact_wa_id text not null,
        direction text not null,
        body text not null,
        error text,
        created_at timestamptz not null default now()
      )`;
    await sql`alter table settings add column if not exists hookmyapp_api_key text`;
    await sql`alter table settings add column if not exists hookmyapp_workspace_id text`;
    await sql`alter table settings add column if not exists openrouter_api_key text`;
    await sql`create index if not exists messages_contact_idx on messages (contact_wa_id, created_at desc)`;
    await sql`
      insert into settings (id, system_prompt, model)
      values (1, ${DEFAULT_PROMPT}, ${DEFAULT_MODEL})
      on conflict (id) do nothing`;
  })();
  return ready;
}

export async function getSettings(): Promise<Settings> {
  await init();
  const rows = (await sql`select * from settings where id = 1`) as Settings[];
  return rows[0];
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  // undefined means "leave as is"; null is a real value that clears a column.
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const next = { ...current, ...defined } as Settings;
  const rows = (await sql`
    update settings set
      system_prompt = ${next.system_prompt},
      model = ${next.model},
      mode = ${next.mode},
      api_base = ${next.api_base},
      channel_id = ${next.channel_id},
      sandbox_session_id = ${next.sandbox_session_id},
      phone_number_id = ${next.phone_number_id},
      channel_token = ${next.channel_token},
      hmac_secret = ${next.hmac_secret},
      verify_token = ${next.verify_token},
      hookmyapp_api_key = ${next.hookmyapp_api_key},
      hookmyapp_workspace_id = ${next.hookmyapp_workspace_id},
      openrouter_api_key = ${next.openrouter_api_key},
      updated_at = now()
    where id = 1
    returning *`) as Settings[];
  return rows[0];
}

export async function addMessage(m: {
  contact: string;
  direction: 'in' | 'out';
  body: string;
  error?: string | null;
}): Promise<void> {
  await init();
  await sql`
    insert into messages (contact_wa_id, direction, body, error)
    values (${m.contact}, ${m.direction}, ${m.body}, ${m.error ?? null})`;
}

/** Oldest-first history for one contact, capped at the last `limit` messages. */
export async function history(contact: string, limit = 20): Promise<Message[]> {
  await init();
  const rows = (await sql`
    select * from (
      select * from messages where contact_wa_id = ${contact}
      order by created_at desc limit ${limit}
    ) t order by created_at asc`) as Message[];
  return rows;
}

export async function contacts(): Promise<{ contact_wa_id: string; last_at: string }[]> {
  await init();
  return (await sql`
    select contact_wa_id, max(created_at) as last_at
    from messages group by contact_wa_id order by last_at desc limit 50`) as {
    contact_wa_id: string;
    last_at: string;
  }[];
}
