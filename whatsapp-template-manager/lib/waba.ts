import type { LiveTemplate, Template } from "./core";
import { validate } from "./core";

/**
 * Talking to the WhatsApp Business account.
 *
 * Two ways in, one client. A HookMyApp token (`hmat_…`) goes through the
 * HookMyApp gateway, which holds the Meta credentials for you and speaks the
 * Graph API verbatim. A Meta token goes straight to Graph. Nothing else
 * changes, so the rest of the app never learns which one is in use.
 */

const GRAPH = "https://graph.facebook.com";
const GATEWAY = "https://gateway.hookmyapp.com/meta";
const VERSION = "v22.0";

export interface Connection {
  token: string;
  wabaId: string;
  /** Needed only to send a test message. */
  phoneNumberId?: string;
  /** Overrides the base URL the token would otherwise choose. */
  base?: string;
  version?: string;
}

/** The connection from the environment, or null when it is not set up. */
export function connection(): Connection | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const wabaId = process.env.WABA_ID?.trim();
  if (!token || !wabaId) return null;
  return {
    token,
    wabaId,
    phoneNumberId: process.env.PHONE_NUMBER_ID?.trim(),
    base: process.env.WHATSAPP_API?.trim(),
    version: process.env.WHATSAPP_VERSION?.trim(),
  };
}

/** Where to send. A HookMyApp token goes through HookMyApp. */
function baseOf(connection: Connection): string {
  if (connection.base) return connection.base.replace(/\/$/, "");
  return connection.token.startsWith("hmat_") ? GATEWAY : GRAPH;
}

export class WabaError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** The Graph error code, when there is one, ready for `decode()`. */
  readonly code?: string;

  constructor(status: number, body: unknown) {
    const error = (body as { error?: { message?: string; code?: number } })?.error;
    super(error?.message ?? `The WhatsApp API answered ${status}.`);
    this.name = "WabaError";
    this.status = status;
    this.body = body;
    this.code = error?.code ? String(error.code) : undefined;
  }

  /** The whole answer, for pasting into the rejection reader. */
  get raw(): string {
    return JSON.stringify(this.body, null, 2);
  }
}

async function call<T>(
  connection: Connection,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${baseOf(connection)}/${connection.version ?? VERSION}/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new WabaError(response.status, body);
  return body as T;
}

const FIELDS = [
  "id",
  "name",
  "language",
  "category",
  "status",
  "parameter_format",
  "components",
  "rejected_reason",
  "quality_score",
].join(",");

/** Every template on the account, newest page first. */
export async function pull(connection: Connection, limit = 200): Promise<LiveTemplate[]> {
  const answer = await call<{ data: LiveTemplate[] }>(
    connection,
    `${connection.wabaId}/message_templates?fields=${FIELDS}&limit=${limit}`,
  );
  return answer.data ?? [];
}

/**
 * Create the template, or update it when `id` is given. Validation runs first,
 * so a template with errors never costs a round trip or a rejection on the
 * account's record.
 */
export async function push(
  connection: Connection,
  template: Template,
  id?: string,
): Promise<{ id: string; status?: string }> {
  const result = validate(template);
  if (!result.ok) {
    throw new Error(
      `Not submitted, because it would be rejected:\n${result.errors.map((issue) => `- ${issue.message}`).join("\n")}`,
    );
  }

  const body = JSON.stringify({
    name: template.name,
    language: template.language,
    category: template.category,
    ...(template.parameter_format ? { parameter_format: template.parameter_format } : {}),
    components: template.components,
  });

  // Editing an approved template goes to the template itself, and Meta only
  // accepts the components and the category there.
  if (id) {
    await call(connection, id, {
      method: "POST",
      body: JSON.stringify({ category: template.category, components: template.components }),
    });
    return { id };
  }
  return call<{ id: string; status?: string }>(connection, `${connection.wabaId}/message_templates`, {
    method: "POST",
    body,
  });
}

export async function destroy(connection: Connection, name: string): Promise<void> {
  await call(connection, `${connection.wabaId}/message_templates?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

/**
 * Send the approved template to one number, so the render can be looked at on
 * a real phone rather than guessed at from a preview.
 *
 * `values` is keyed the way the template is: `{ "1": "Sam" }` when it is
 * numbered, `{ name: "Sam" }` when it is named.
 */
export async function send(
  connection: Connection,
  template: Template,
  to: string,
  values: Record<string, string>,
): Promise<{ messageId: string }> {
  if (!connection.phoneNumberId) {
    throw new Error("Set PHONE_NUMBER_ID to send a test message.");
  }

  const named = template.parameter_format === "NAMED";
  const parameter = (token: string) => ({
    type: "text" as const,
    text: values[token] ?? "",
    ...(named ? { parameter_name: token } : {}),
  });

  const components: Array<Record<string, unknown>> = [];
  for (const component of template.components) {
    if (component.type === "HEADER" && component.format === "TEXT" && component.text) {
      const tokens = placeholderTokens(component.text);
      if (tokens.length) {
        components.push({ type: "header", parameters: tokens.map(parameter) });
      }
    }
    if (component.type === "BODY" && component.text) {
      const tokens = placeholderTokens(component.text);
      if (tokens.length) {
        components.push({ type: "body", parameters: tokens.map(parameter) });
      }
    }
    if (component.type === "BUTTONS") {
      component.buttons.forEach((button, index) => {
        if (button.type !== "URL") return;
        const tokens = placeholderTokens(button.url);
        if (!tokens.length) return;
        components.push({
          type: "button",
          sub_type: "url",
          index: String(index),
          parameters: [{ type: "text", text: values[tokens[0]] ?? "" }],
        });
      });
    }
  }

  const answer = await call<{ messages: Array<{ id: string }> }>(
    connection,
    `${connection.phoneNumberId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          ...(components.length ? { components } : {}),
        },
      }),
    },
  );
  return { messageId: answer.messages?.[0]?.id ?? "" };
}

function placeholderTokens(text: string): string[] {
  const found = [...text.matchAll(/\{\{\s*([^{}\s][^{}]*?)\s*\}\}/g)].map((match) => match[1].trim());
  return [...new Set(found)];
}
