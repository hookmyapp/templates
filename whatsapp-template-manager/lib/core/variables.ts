import type { ParameterFormat } from "./types";

/**
 * Reading the `{{...}}` placeholders out of template text.
 *
 * A template is either positional (`{{1}}`, `{{2}}`) or named
 * (`{{order_id}}`), never both, and Meta rejects the mix. Both live here so a
 * caller can ask what a piece of text actually contains before deciding.
 */

const PLACEHOLDER = /\{\{\s*([^{}\s][^{}]*?)\s*\}\}/g;

export interface Placeholder {
  /** The text between the braces, trimmed. */
  token: string;
  /** Character offset of the opening brace. */
  index: number;
  /** The whole `{{...}}` match. */
  raw: string;
}

/** Every placeholder in `text`, in the order it appears, repeats included. */
export function placeholders(text: string): Placeholder[] {
  const found: Placeholder[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    found.push({
      token: match[1].trim(),
      index: match.index,
      raw: match[0],
    });
  }
  return found;
}

/** The distinct placeholder tokens, in first-seen order. */
export function tokens(text: string): string[] {
  return [...new Set(placeholders(text).map((p) => p.token))];
}

/** Positional indices in `text`, ascending and deduplicated. */
export function positions(text: string): number[] {
  const numeric = tokens(text)
    .filter((t) => /^\d+$/.test(t))
    .map(Number);
  return [...new Set(numeric)].sort((a, b) => a - b);
}

/** Named tokens in `text`, in first-seen order. */
export function names(text: string): string[] {
  return tokens(text).filter((t) => !/^\d+$/.test(t));
}

/**
 * Which format a piece of text is written in. `mixed` means both styles are
 * present, which Meta will not accept either way.
 */
export function formatOf(text: string): ParameterFormat | "mixed" | "none" {
  const hasNumeric = positions(text).length > 0;
  const hasNamed = names(text).length > 0;
  if (hasNumeric && hasNamed) return "mixed";
  if (hasNumeric) return "POSITIONAL";
  if (hasNamed) return "NAMED";
  return "none";
}

/** True when text starts with a placeholder, which Meta rejects. */
export function startsWithPlaceholder(text: string): boolean {
  return /^\s*\{\{/.test(text);
}

/** True when text ends with a placeholder, which Meta rejects. */
export function endsWithPlaceholder(text: string): boolean {
  return /\}\}\s*$/.test(text);
}

/** True when two placeholders sit next to each other, which Meta rejects. */
export function hasAdjacentPlaceholders(text: string): boolean {
  return /\}\}\s*\{\{/.test(text);
}

/**
 * Replace each placeholder with its sample. `samples` is keyed by token, so
 * `{ "1": "Sam" }` for a positional template and `{ order_id: "A-1" }` for a
 * named one. A placeholder with no sample is left visible rather than blanked,
 * so the preview shows what is still missing.
 */
export function fill(text: string, samples: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (raw, token: string) => {
    const value = samples[token.trim()];
    return value ? value : raw;
  });
}
