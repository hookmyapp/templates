/**
 * Turning template text into the HTML the preview draws.
 *
 * The order matters: escape first, format second. Sample values come from
 * whoever is editing the template and from whatever a WABA hands back, so
 * they are treated as text, never as markup.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

/**
 * Apply WhatsApp's formatting to already-escaped text:
 * `*bold*`, `_italic_`, `~strikethrough~`, ` ```monospace``` `.
 *
 * Monospace goes first so its contents are left alone, and newlines go last so
 * the inline markers never reach across a line the way they never do in the
 * app.
 */
export function toHtml(text: string): string {
  return escapeHtml(text)
    .replace(/```([^`]+)```/g, "<code>$1</code>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<b>$2</b>")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<i>$2</i>")
    .replace(/(^|[\s(])~([^~\n]+)~/g, "$1<s>$2</s>")
    .replace(/\n/g, "<br>");
}

/** Strip the formatting markers, for a plain-text rendering of the same text. */
export function toPlain(text: string): string {
  return text
    .replace(/```([^`]+)```/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
    .replace(/(^|[\s(])~([^~\n]+)~/g, "$1$2");
}
