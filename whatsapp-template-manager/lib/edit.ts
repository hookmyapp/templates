import type {
  BodyComponent,
  Component,
  ComponentType,
  HeaderComponent,
  Template,
} from "./core";
import { tokens } from "./core";

/**
 * Changing a template without mutating it.
 *
 * Every helper returns a new template, so React sees a new object and the
 * undo story stays simple. Components are kept in the order Meta reads them,
 * which means the editor never has to think about where a new one goes.
 */

const ORDER: ComponentType[] = [
  "HEADER",
  "BODY",
  "LIMITED_TIME_OFFER",
  "FOOTER",
  "BUTTONS",
  "CAROUSEL",
];

function sort(components: Component[]): Component[] {
  return [...components].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
}

/** Add the component, or replace the one already there. */
export function put(template: Template, component: Component): Template {
  const rest = template.components.filter((existing) => existing.type !== component.type);
  return { ...template, components: sort([...rest, component]) };
}

export function drop(template: Template, type: ComponentType): Template {
  return { ...template, components: template.components.filter((c) => c.type !== type) };
}

export function get<T extends Component>(template: Template, type: ComponentType): T | undefined {
  return template.components.find((component) => component.type === type) as T | undefined;
}

/**
 * Keep the sample list the same length as the placeholder list.
 *
 * Renumbering a body used to leave orphaned samples behind, which reads as a
 * passing template right up until the submission comes back.
 */
export function syncSamples(template: Template): Template {
  const body = get<BodyComponent>(template, "BODY");
  const header = get<HeaderComponent>(template, "HEADER");
  let next = template;

  if (body?.text) {
    const wanted = tokens(body.text);
    if (template.parameter_format === "NAMED") {
      const had = new Map(
        (body.example?.body_text_named_params ?? []).map((param) => [param.param_name, param.example]),
      );
      next = put(next, {
        ...body,
        example: {
          body_text_named_params: wanted.map((name) => ({
            param_name: name,
            example: had.get(name) ?? "",
          })),
        },
      });
    } else {
      const had = body.example?.body_text?.[0] ?? [];
      next = put(next, {
        ...body,
        example: { body_text: [wanted.map((_, index) => had[index] ?? "")] },
      });
    }
  }

  if (header?.format === "TEXT" && header.text) {
    const wanted = tokens(header.text);
    const had = header.example?.header_text ?? [];
    next = put(next, {
      ...get<HeaderComponent>(next, "HEADER")!,
      example: wanted.length ? { header_text: wanted.map((_, index) => had[index] ?? "") } : undefined,
    });
  }

  return next;
}

/** The next placeholder to insert, given what the text already uses. */
export function nextPlaceholder(text: string, format: "POSITIONAL" | "NAMED"): string {
  if (format === "NAMED") return "{{name}}";
  const used = tokens(text)
    .filter((token) => /^\d+$/.test(token))
    .map(Number);
  return `{{${used.length ? Math.max(...used) + 1 : 1}}}`;
}
