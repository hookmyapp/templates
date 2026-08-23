import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { keyOf, type Template } from "./core";

/**
 * Where the templates live: one JSON file each, in `templates/`.
 *
 * A file rather than a database, because the point of this app is that an AI
 * agent sitting in the same folder can read a template, change it, and have
 * the change show up in the browser and in `git diff`. A row in Postgres does
 * none of that.
 *
 * A deployment has no writable disk, so saving is turned off there and the app
 * becomes a reader of whatever was committed. The editor says so rather than
 * losing work quietly.
 */

const DIR = path.join(process.cwd(), "templates");
const COMMENTS = path.join(process.cwd(), "comments.json");

export { keyOf };

const fileOf = (key: string) => path.join(DIR, `${key}.json`);

/** A key that could escape the templates folder is not a key. */
function assertKey(key: string): void {
  if (!/^[a-z0-9_]+\.[A-Za-z_]+$/.test(key)) {
    throw new Error(`"${key}" is not a template key. Expected something like order_update.en_US.`);
  }
}

export async function list(): Promise<Template[]> {
  let files: string[];
  try {
    files = await readdir(DIR);
  } catch {
    return [];
  }
  const templates = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          return JSON.parse(await readFile(path.join(DIR, file), "utf8")) as Template;
        } catch {
          // A half-written or hand-mangled file should not take the page down.
          return null;
        }
      }),
  );
  return templates
    .filter((template): template is Template => Boolean(template?.name))
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

export async function read(key: string): Promise<Template | null> {
  assertKey(key);
  try {
    return JSON.parse(await readFile(fileOf(key), "utf8")) as Template;
  } catch {
    return null;
  }
}

export async function write(template: Template): Promise<string> {
  const key = keyOf(template);
  assertKey(key);
  await writeFile(fileOf(key), `${JSON.stringify(template, null, 2)}\n`);
  return key;
}

export async function remove(key: string): Promise<void> {
  assertKey(key);
  await unlink(fileOf(key)).catch(() => {});
}

/** True when this copy can save. False on a deployment, where the disk is read-only. */
export async function writable(): Promise<boolean> {
  const probe = path.join(DIR, ".writable");
  try {
    await writeFile(probe, "");
    await unlink(probe);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- comments */

/**
 * A note left on a template, for the agent to act on.
 *
 * `path` is the same dotted path the validator uses, so a comment on
 * `components.1.text` and an error on `components.1.text` point at the same
 * field, and the agent does not have to guess which sentence you meant.
 */
export interface Comment {
  id: string;
  /** Template key, e.g. `order_update.en_US`. */
  template: string;
  /** Field the note is attached to, when it is attached to one. */
  path?: string;
  /** The text that was highlighted when the note was written. */
  quote?: string;
  /** What you want changed. */
  body: string;
  status: "open" | "done";
  created: string;
  /** What the agent did about it. */
  answered?: { at: string; note: string };
}

export async function comments(): Promise<Comment[]> {
  try {
    const parsed = JSON.parse(await readFile(COMMENTS, "utf8")) as Comment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveComments(all: Comment[]): Promise<void> {
  await writeFile(COMMENTS, `${JSON.stringify(all, null, 2)}\n`);
}

export async function addComment(
  comment: Omit<Comment, "id" | "created" | "status">,
): Promise<Comment> {
  const created: Comment = {
    ...comment,
    id: `c_${Math.random().toString(36).slice(2, 8)}`,
    status: "open",
    created: new Date().toISOString(),
  };
  await saveComments([...(await comments()), created]);
  return created;
}

export async function updateComment(id: string, patch: Partial<Comment>): Promise<Comment | null> {
  const all = await comments();
  const found = all.find((comment) => comment.id === id);
  if (!found) return null;
  Object.assign(found, patch, { id: found.id });
  await saveComments(all);
  return found;
}

export async function deleteComment(id: string): Promise<void> {
  await saveComments((await comments()).filter((comment) => comment.id !== id));
}
