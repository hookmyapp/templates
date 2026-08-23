import type { BodyComponent, Button, HeaderComponent, Template } from "./types";
import { tokens } from "./variables";

/**
 * The sample values a template carries, keyed by placeholder token.
 *
 * Header, body and each URL button number their placeholders from one
 * separately. A header's `{{1}}` and a body's `{{1}}` are different values, so
 * so samples are read per component rather than pooled.
 */

export function headerSamples(header?: HeaderComponent): Record<string, string> {
  if (!header?.text) return {};
  const named = header.example?.header_text_named_params;
  if (named?.length) {
    return Object.fromEntries(named.map((param) => [param.param_name, param.example]));
  }
  const positional = header.example?.header_text ?? [];
  return Object.fromEntries(tokens(header.text).map((token, index) => [token, positional[index] ?? ""]));
}

export function bodySamples(body?: BodyComponent): Record<string, string> {
  if (!body?.text) return {};
  const named = body.example?.body_text_named_params;
  if (named?.length) {
    return Object.fromEntries(named.map((param) => [param.param_name, param.example]));
  }
  const positional = body.example?.body_text?.[0] ?? [];
  return Object.fromEntries(tokens(body.text).map((token, index) => [token, positional[index] ?? ""]));
}

/**
 * What to send for each placeholder in the body, so a test message goes out
 * filled in the way the reviewer saw it.
 */
export function sendValues(template: Template): Record<string, string> {
  const body = template.components.find((component) => component.type === "BODY") as
    | BodyComponent
    | undefined;
  return bodySamples(body);
}

/** The sample a URL button's placeholder carries, if it has one. */
export function buttonSample(button: Button): string {
  return button.type === "URL" ? (button.example?.[0] ?? "") : "";
}

/**
 * Name and language together identify a template, so both make the key that
 * names its file and its page.
 */
export function keyOf(template: Pick<Template, "name" | "language">): string {
  return `${template.name}.${template.language}`;
}
