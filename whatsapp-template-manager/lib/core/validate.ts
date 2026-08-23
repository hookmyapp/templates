import type {
  BodyComponent,
  ButtonsComponent,
  Button,
  CarouselComponent,
  Component,
  ComponentType,
  FooterComponent,
  HeaderComponent,
  LimitedTimeOfferComponent,
  Template,
} from "./types";
import { CATEGORIES, FORMAT_RULES, LIMITS, NAME_PATTERN, PARAM_NAME_PATTERN } from "./limits";
import { isLanguage } from "./languages";
import {
  endsWithPlaceholder,
  formatOf,
  hasAdjacentPlaceholders,
  names,
  positions,
  startsWithPlaceholder,
  tokens,
} from "./variables";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  /** Stable id, e.g. `body.placeholders.gap`. Safe to match on. */
  rule: string;
  message: string;
  /** What to do about it, in one sentence. */
  fix?: string;
  /**
   * Where the problem is, as a dotted path into the template:
   * `components.1.text`, `components.2.buttons.0.url`. The editor uses it to
   * point at the field, and an agent uses it to know what to change.
   */
  path: string;
  component?: ComponentType;
}

export interface Result {
  /** True when nothing is an error. Warnings do not block a submission. */
  ok: boolean;
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
}

/**
 * Check a template against the rules Meta applies when it reviews one.
 *
 * Errors are the things that come back as a rejection or an API error.
 * Warnings are the things that get through review and then bite later: a
 * missing sample, an offer with no countdown, a code that never expires.
 */
export function validate(template: Template): Result {
  const issues: Issue[] = [];
  const add =
    (severity: Severity) =>
    (rule: string, path: string, message: string, fix?: string, component?: ComponentType) => {
      issues.push({ severity, rule, path, message, fix, component });
    };
  const error = add("error");
  const warn = add("warning");

  checkName(template.name, error);
  checkLanguage(template.language, error, warn);

  if (!CATEGORIES.includes(template.category)) {
    error(
      "category.invalid",
      "category",
      `Category must be one of ${CATEGORIES.join(", ")}.`,
      "Pick the category that matches what the message does.",
    );
  }

  const components = template.components ?? [];
  const pick = <T extends Component>(type: ComponentType) =>
    components
      .map((component, index) => ({ component, index }))
      .filter((entry) => entry.component.type === type) as Array<{ component: T; index: number }>;

  const headers = pick<HeaderComponent>("HEADER");
  const bodies = pick<BodyComponent>("BODY");
  const footers = pick<FooterComponent>("FOOTER");
  const buttonBlocks = pick<ButtonsComponent>("BUTTONS");
  const carousels = pick<CarouselComponent>("CAROUSEL");
  const offers = pick<LimitedTimeOfferComponent>("LIMITED_TIME_OFFER");

  for (const [type, found] of [
    ["HEADER", headers],
    ["BODY", bodies],
    ["FOOTER", footers],
    ["BUTTONS", buttonBlocks],
    ["CAROUSEL", carousels],
    ["LIMITED_TIME_OFFER", offers],
  ] as const) {
    if (found.length > 1) {
      error(
        "component.duplicate",
        `components.${found[1].index}`,
        `A template can only have one ${type} component, and this one has ${found.length}.`,
        `Delete the extra ${type}.`,
        type,
      );
    }
  }
  if (bodies.length === 0) {
    error("body.missing", "components", "Every template needs a body.", "Add a BODY component.", "BODY");
  }

  const format = declaredFormat(template);
  checkParameterFormat(template, format, error);

  const header = headers[0];
  const body = bodies[0];
  const footer = footers[0];
  const buttons = buttonBlocks[0];
  const carousel = carousels[0];
  const offer = offers[0];

  if (header) checkHeader(header.component, `components.${header.index}`, format, error, warn);
  if (body) checkBody(body.component, `components.${body.index}`, template, format, error, warn);
  if (footer) checkFooter(footer.component, `components.${footer.index}`, template, error, warn);
  if (buttons) checkButtons(buttons.component, `components.${buttons.index}`, template, error, warn);
  if (carousel) checkCarousel(carousel.component, `components.${carousel.index}`, error, warn);
  if (offer) checkOffer(offer.component, `components.${offer.index}`, template, error, warn);

  checkCategoryShape(template, { header, body, footer, buttons, carousel, offer }, error, warn);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { ok: errors.length === 0, issues, errors, warnings };
}

type Report = (
  rule: string,
  path: string,
  message: string,
  fix?: string,
  component?: ComponentType,
) => void;

type Slots = {
  header?: { component: HeaderComponent; index: number };
  body?: { component: BodyComponent; index: number };
  footer?: { component: FooterComponent; index: number };
  buttons?: { component: ButtonsComponent; index: number };
  carousel?: { component: CarouselComponent; index: number };
  offer?: { component: LimitedTimeOfferComponent; index: number };
};

/* -------------------------------------------------------------- name, language */

function checkName(name: string, error: Report): void {
  if (!name?.trim()) {
    error("name.missing", "name", "The template needs a name.", "Use lowercase words joined by underscores.");
    return;
  }
  if (name.length > LIMITS.NAME) {
    error("name.length", "name", `The name is ${name.length} characters, and ${LIMITS.NAME} is the limit.`);
  }
  if (!NAME_PATTERN.test(name)) {
    error(
      "name.characters",
      "name",
      "A name can only hold lowercase letters, digits and underscores.",
      `Try "${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}".`,
    );
  }
}

function checkLanguage(language: string, error: Report, warn: Report): void {
  if (!language?.trim()) {
    error("language.missing", "language", "The template needs a language code.", 'For example "en_US".');
    return;
  }
  if (!isLanguage(language)) {
    warn(
      "language.unknown",
      "language",
      `"${language}" is not a code WhatsApp lists.`,
      "Check it against the language picker before you submit.",
    );
  }
}

/* ------------------------------------------------------------ parameter format */

/** The format the template declares, defaulting to positional. */
function declaredFormat(template: Template): "POSITIONAL" | "NAMED" {
  return template.parameter_format === "NAMED" ? "NAMED" : "POSITIONAL";
}

/** Every piece of text a placeholder may appear in, with its path. */
function textFields(template: Template): Array<{ path: string; text: string }> {
  const fields: Array<{ path: string; text: string }> = [];
  template.components.forEach((component, index) => {
    const at = `components.${index}`;
    if (component.type === "HEADER" && component.text) fields.push({ path: `${at}.text`, text: component.text });
    if (component.type === "BODY" && component.text) fields.push({ path: `${at}.text`, text: component.text });
    if (component.type === "BUTTONS") {
      component.buttons.forEach((button, b) => {
        if (button.type === "URL") fields.push({ path: `${at}.buttons.${b}.url`, text: button.url });
      });
    }
    if (component.type === "CAROUSEL") {
      component.cards.forEach((card, c) => {
        card.components.forEach((cardComponent, k) => {
          const cardAt = `${at}.cards.${c}.components.${k}`;
          if (cardComponent.type === "BODY" && cardComponent.text) {
            fields.push({ path: `${cardAt}.text`, text: cardComponent.text });
          }
          if (cardComponent.type === "BUTTONS") {
            cardComponent.buttons.forEach((button, b) => {
              if (button.type === "URL") fields.push({ path: `${cardAt}.buttons.${b}.url`, text: button.url });
            });
          }
        });
      });
    }
  });
  return fields;
}

function checkParameterFormat(
  template: Template,
  format: "POSITIONAL" | "NAMED",
  error: Report,
): void {
  for (const field of textFields(template)) {
    const actual = formatOf(field.text);
    if (actual === "mixed") {
      error(
        "parameters.mixed",
        field.path,
        "This text mixes numbered and named placeholders.",
        "Pick one style and use it everywhere in the template.",
      );
      continue;
    }
    if (actual !== "none" && actual !== format) {
      error(
        "parameters.format",
        field.path,
        actual === "NAMED"
          ? "This template is numbered, but the text uses named placeholders."
          : "This template is named, but the text uses numbered placeholders.",
        `Switch the template to ${actual === "NAMED" ? "named" : "numbered"} parameters, or rewrite the placeholders.`,
      );
    }
    if (format === "NAMED") {
      for (const name of names(field.text)) {
        if (!PARAM_NAME_PATTERN.test(name)) {
          error(
            "parameters.name",
            field.path,
            `"{{${name}}}" is not a usable parameter name.`,
            "Use lowercase letters, digits and underscores.",
          );
        }
      }
    }
  }
}

/** Tabs and long runs of whitespace that fail Meta's format check. */
function checkFormatting(text: string, path: string, where: string, error: Report): void {
  for (const rule of FORMAT_RULES) {
    if (rule.pattern.test(text)) {
      error(
        `format.${rule.id}`,
        path,
        `The ${where} contains ${rule.label}, which WhatsApp rejects.`,
        "Remove it. Two newlines is the most you need for a blank line.",
      );
    }
  }
}

/* ------------------------------------------------------------------ components */

function checkHeader(
  header: HeaderComponent,
  path: string,
  format: "POSITIONAL" | "NAMED",
  error: Report,
  warn: Report,
): void {
  if (header.format !== "TEXT") {
    if (header.text) {
      error(
        "header.media.text",
        `${path}.text`,
        `A ${header.format} header carries no text.`,
        "Move the wording into the body.",
        "HEADER",
      );
    }
    if (header.format !== "LOCATION" && !header.example?.header_handle?.length) {
      warn(
        "header.media.sample",
        `${path}.example`,
        `Reviewers need a sample ${header.format.toLowerCase()} to look at.`,
        "Upload one, or paste a public URL to the file.",
        "HEADER",
      );
    }
    return;
  }

  const text = header.text ?? "";
  if (!text.trim()) {
    error("header.empty", `${path}.text`, "The header has no text.", "Write it, or delete the header.", "HEADER");
    return;
  }
  if (text.length > LIMITS.HEADER_TEXT) {
    error(
      "header.length",
      `${path}.text`,
      `The header is ${text.length} characters, and ${LIMITS.HEADER_TEXT} is the limit.`,
      undefined,
      "HEADER",
    );
  }
  if (text.includes("\n")) {
    error("header.newline", `${path}.text`, "A header is a single line.", "Remove the line breaks.", "HEADER");
  }
  checkFormatting(text, `${path}.text`, "header", error);

  const found = tokens(text);
  if (found.length > 1) {
    error(
      "header.placeholders.count",
      `${path}.text`,
      `A header holds one placeholder, and this has ${found.length}.`,
      "Move the rest into the body.",
      "HEADER",
    );
  }
  if (found.length === 1) {
    if (format === "POSITIONAL" && found[0] !== "1") {
      error(
        "header.placeholders.index",
        `${path}.text`,
        `The header placeholder has to be {{1}}, not {{${found[0]}}}.`,
        undefined,
        "HEADER",
      );
    }
    const hasSample =
      header.example?.header_text?.length || header.example?.header_text_named_params?.length;
    if (!hasSample) {
      warn(
        "header.sample",
        `${path}.example`,
        "The header placeholder has no sample value.",
        "Reviewers reject templates they cannot picture filled in.",
        "HEADER",
      );
    }
  }
}

function checkBody(
  body: BodyComponent,
  path: string,
  template: Template,
  format: "POSITIONAL" | "NAMED",
  error: Report,
  warn: Report,
): void {
  const authentication = template.category === "AUTHENTICATION";
  const text = body.text ?? "";

  if (authentication) {
    if (text.trim()) {
      error(
        "body.authentication.text",
        `${path}.text`,
        "WhatsApp writes the text of an authentication body itself.",
        "Delete the text and set add_security_recommendation instead.",
        "BODY",
      );
    }
    return;
  }

  if (!text.trim()) {
    error("body.empty", `${path}.text`, "The body has no text.", undefined, "BODY");
    return;
  }
  if (text.length > LIMITS.BODY) {
    error(
      "body.length",
      `${path}.text`,
      `The body is ${text.length} characters, and ${LIMITS.BODY} is the limit.`,
      `Cut ${text.length - LIMITS.BODY} characters.`,
      "BODY",
    );
  }
  checkFormatting(text, `${path}.text`, "body", error);
  checkPlaceholderPlacement(text, `${path}.text`, "body", error, "BODY");

  const found = tokens(text);
  if (found.length === 0) return;

  if (format === "POSITIONAL") {
    const used = positions(text);
    const sequential = used[0] === 1 && used.every((value, i) => value === i + 1);
    if (!sequential) {
      error(
        "body.placeholders.gap",
        `${path}.text`,
        `Placeholders run 1, 2, 3 with no gaps. This body uses ${used.map((n) => `{{${n}}}`).join(", ")}.`,
        "Renumber them from {{1}}.",
        "BODY",
      );
    }
    const samples = body.example?.body_text?.[0] ?? [];
    if (samples.length < used.length) {
      warn(
        "body.samples",
        `${path}.example`,
        `${used.length} placeholder${used.length === 1 ? "" : "s"} in the body, ${samples.length} sample${samples.length === 1 ? "" : "s"} given.`,
        "Fill them in. A template without samples is usually rejected.",
        "BODY",
      );
    }
  } else {
    const given = new Set((body.example?.body_text_named_params ?? []).map((p) => p.param_name));
    const missing = names(text).filter((name) => !given.has(name));
    if (missing.length) {
      warn(
        "body.samples",
        `${path}.example`,
        `No sample for ${missing.map((name) => `{{${name}}}`).join(", ")}.`,
        "Fill them in. A template without samples is usually rejected.",
        "BODY",
      );
    }
  }
}

function checkPlaceholderPlacement(
  text: string,
  path: string,
  where: string,
  error: Report,
  component: ComponentType,
): void {
  if (startsWithPlaceholder(text)) {
    error(
      "placeholders.start",
      path,
      `The ${where} opens with a placeholder, which WhatsApp rejects.`,
      "Put a word in front of it.",
      component,
    );
  }
  if (endsWithPlaceholder(text)) {
    error(
      "placeholders.end",
      path,
      `The ${where} ends with a placeholder, which WhatsApp rejects.`,
      "Put a word after it, even a full stop will not do.",
      component,
    );
  }
  if (hasAdjacentPlaceholders(text)) {
    error(
      "placeholders.adjacent",
      path,
      `Two placeholders sit next to each other in the ${where}.`,
      "Write something between them.",
      component,
    );
  }
}

function checkFooter(
  footer: FooterComponent,
  path: string,
  template: Template,
  error: Report,
  warn: Report,
): void {
  const authentication = template.category === "AUTHENTICATION";
  const text = footer.text ?? "";

  if (authentication) {
    if (text.trim()) {
      error(
        "footer.authentication.text",
        `${path}.text`,
        "An authentication footer is the expiry line, and WhatsApp writes it.",
        "Set code_expiration_minutes instead of text.",
        "FOOTER",
      );
    }
    const minutes = footer.code_expiration_minutes;
    if (minutes === undefined) {
      warn(
        "footer.expiry.missing",
        `${path}.code_expiration_minutes`,
        "The code never expires.",
        "Set a lifetime between 1 and 90 minutes.",
        "FOOTER",
      );
    } else if (minutes < LIMITS.CODE_EXPIRATION_MIN || minutes > LIMITS.CODE_EXPIRATION_MAX) {
      error(
        "footer.expiry.range",
        `${path}.code_expiration_minutes`,
        `A code lives between ${LIMITS.CODE_EXPIRATION_MIN} and ${LIMITS.CODE_EXPIRATION_MAX} minutes, and this says ${minutes}.`,
        undefined,
        "FOOTER",
      );
    }
    return;
  }

  if (!text.trim()) {
    error("footer.empty", `${path}.text`, "The footer has no text.", "Write it, or delete the footer.", "FOOTER");
    return;
  }
  if (text.length > LIMITS.FOOTER) {
    error(
      "footer.length",
      `${path}.text`,
      `The footer is ${text.length} characters, and ${LIMITS.FOOTER} is the limit.`,
      undefined,
      "FOOTER",
    );
  }
  if (tokens(text).length) {
    error(
      "footer.placeholders",
      `${path}.text`,
      "A footer is the same for everyone, so it cannot hold a placeholder.",
      "Move it into the body.",
      "FOOTER",
    );
  }
}

/* --------------------------------------------------------------------- buttons */

const NEEDS_LABEL: ReadonlySet<string> = new Set([
  "QUICK_REPLY",
  "URL",
  "PHONE_NUMBER",
  "VOICE_CALL",
  "CATALOG",
  "MPM",
  "FLOW",
]);

function checkButtons(
  block: ButtonsComponent,
  path: string,
  template: Template,
  error: Report,
  warn: Report,
): void {
  const buttons = block.buttons ?? [];
  if (buttons.length === 0) {
    warn("buttons.empty", path, "The buttons block is empty.", "Add a button, or delete the block.", "BUTTONS");
    return;
  }
  if (buttons.length > LIMITS.BUTTONS) {
    error(
      "buttons.count",
      path,
      `${buttons.length} buttons, and ${LIMITS.BUTTONS} is the limit.`,
      undefined,
      "BUTTONS",
    );
  }

  const count = (type: Button["type"]) => buttons.filter((button) => button.type === type).length;
  const caps: Array<[Button["type"], number, string]> = [
    ["URL", LIMITS.URL_BUTTONS, "URL"],
    ["PHONE_NUMBER", LIMITS.PHONE_BUTTONS, "phone"],
    ["QUICK_REPLY", LIMITS.QUICK_REPLY_BUTTONS, "quick reply"],
    ["COPY_CODE", LIMITS.COPY_CODE_BUTTONS, "copy code"],
    ["OTP", LIMITS.OTP_BUTTONS, "one-time password"],
    ["FLOW", LIMITS.FLOW_BUTTONS, "flow"],
  ];
  for (const [type, cap, label] of caps) {
    if (count(type) > cap) {
      error(
        "buttons.type.count",
        path,
        `${count(type)} ${label} buttons, and ${cap} is the limit.`,
        undefined,
        "BUTTONS",
      );
    }
  }

  // A quick reply switches the whole keyboard, so WhatsApp needs them in one
  // run. Interleaved with other types the submission comes back as an invalid
  // combination, with nothing to say which button was the problem.
  const isQuickReply = buttons.map((button) => button.type === "QUICK_REPLY");
  const runs = isQuickReply.filter((quick, i) => quick && !isQuickReply[i - 1]).length;
  if (runs > 1) {
    error(
      "buttons.quick_reply.grouped",
      path,
      "The quick replies are split up by other buttons.",
      "Move them together, all before or all after the rest.",
      "BUTTONS",
    );
  }

  const exclusive = buttons.find((button) => button.type === "CATALOG" || button.type === "MPM");
  if (exclusive && buttons.length > 1) {
    error(
      "buttons.exclusive",
      path,
      `A ${exclusive.type === "CATALOG" ? "catalog" : "product list"} button is the only button a template can have.`,
      "Remove the others.",
      "BUTTONS",
    );
  }

  if (template.category !== "AUTHENTICATION" && count("OTP") > 0) {
    error(
      "buttons.otp.category",
      path,
      "A one-time password button only belongs on an authentication template.",
      "Change the category, or use a copy code button.",
      "BUTTONS",
    );
  }
  if (template.category === "AUTHENTICATION") {
    const wrong = buttons.filter((button) => button.type !== "OTP");
    if (wrong.length) {
      error(
        "buttons.authentication.only_otp",
        path,
        "An authentication template carries one OTP button and nothing else.",
        `Remove the ${wrong.map((button) => button.type).join(", ")} button.`,
        "BUTTONS",
      );
    }
  }

  buttons.forEach((button, index) => {
    checkButton(button, `${path}.buttons.${index}`, index, error, warn);
  });
}

function checkButton(button: Button, path: string, index: number, error: Report, warn: Report): void {
  const label = `Button ${index + 1}`;

  if (NEEDS_LABEL.has(button.type)) {
    const text = "text" in button ? (button.text ?? "") : "";
    if (!text.trim()) {
      error("button.text.missing", `${path}.text`, `${label} has no label.`, undefined, "BUTTONS");
    } else if (text.length > LIMITS.BUTTON_TEXT) {
      error(
        "button.text.length",
        `${path}.text`,
        `${label}'s label is ${text.length} characters, and ${LIMITS.BUTTON_TEXT} is the limit.`,
        undefined,
        "BUTTONS",
      );
    }
  }

  switch (button.type) {
    case "URL": {
      const url = button.url?.trim() ?? "";
      if (!url) {
        error("button.url.missing", `${path}.url`, `${label} has no address.`, undefined, "BUTTONS");
        break;
      }
      if (!/^https?:\/\//i.test(url)) {
        error(
          "button.url.scheme",
          `${path}.url`,
          `${label}'s address has to start with http:// or https://.`,
          undefined,
          "BUTTONS",
        );
      }
      if (url.length > LIMITS.URL) {
        error(
          "button.url.length",
          `${path}.url`,
          `${label}'s address is ${url.length} characters, and ${LIMITS.URL} is the limit.`,
          undefined,
          "BUTTONS",
        );
      }
      const found = tokens(url);
      if (found.length > 1) {
        error(
          "button.url.placeholders",
          `${path}.url`,
          `${label} holds ${found.length} placeholders, and one is the limit.`,
          undefined,
          "BUTTONS",
        );
      }
      if (found.length === 1 && !/\}\}$/.test(url)) {
        error(
          "button.url.placeholder_position",
          `${path}.url`,
          `${label}'s placeholder sits in the middle of the address, and WhatsApp only accepts one at the end.`,
          "Rewrite it as https://example.com/path/{{1}}.",
          "BUTTONS",
        );
      }
      if (found.length === 1 && !button.example?.length) {
        warn(
          "button.url.sample",
          `${path}.example`,
          `${label}'s placeholder has no sample.`,
          "Paste the full address a real customer would land on.",
          "BUTTONS",
        );
      }
      break;
    }
    case "PHONE_NUMBER": {
      const number = button.phone_number?.trim() ?? "";
      if (!number) {
        error("button.phone.missing", `${path}.phone_number`, `${label} has no number.`, undefined, "BUTTONS");
        break;
      }
      if (number.length > LIMITS.PHONE_NUMBER) {
        error(
          "button.phone.length",
          `${path}.phone_number`,
          `${label}'s number is longer than ${LIMITS.PHONE_NUMBER} characters.`,
          undefined,
          "BUTTONS",
        );
      }
      if (!/^\+?[0-9]+$/.test(number)) {
        error(
          "button.phone.format",
          `${path}.phone_number`,
          `${label}'s number can only hold digits and a leading +.`,
          "Write it in full international form, like +15551234567.",
          "BUTTONS",
        );
      }
      break;
    }
    case "COPY_CODE": {
      const code = button.example?.trim() ?? "";
      if (!code) {
        error(
          "button.copy_code.missing",
          `${path}.example`,
          `${label} needs a sample code for the reviewer.`,
          undefined,
          "BUTTONS",
        );
      } else if (code.length > LIMITS.COPY_CODE) {
        error(
          "button.copy_code.length",
          `${path}.example`,
          `${label}'s sample code is ${code.length} characters, and ${LIMITS.COPY_CODE} is the limit.`,
          undefined,
          "BUTTONS",
        );
      }
      break;
    }
    case "OTP": {
      if (!button.otp_type) {
        error(
          "button.otp.type",
          `${path}.otp_type`,
          `${label} does not say how the code reaches the app.`,
          "Pick copy code, one tap or zero tap.",
          "BUTTONS",
        );
        break;
      }
      if (button.otp_type !== "COPY_CODE") {
        const apps = button.supported_apps ?? [];
        if (!apps.length) {
          error(
            "button.otp.apps",
            `${path}.supported_apps`,
            `${label} fills the code in for an app, so it needs to know which app.`,
            "Add the package name and signing hash.",
            "BUTTONS",
          );
        }
        apps.forEach((app, i) => {
          if (!app.package_name?.trim() || !app.signature_hash?.trim()) {
            error(
              "button.otp.app_fields",
              `${path}.supported_apps.${i}`,
              `${label}: app ${i + 1} is missing its package name or signing hash.`,
              undefined,
              "BUTTONS",
            );
          }
        });
      }
      if (button.otp_type === "ZERO_TAP" && !button.zero_tap_terms_accepted) {
        error(
          "button.otp.zero_tap_terms",
          `${path}.zero_tap_terms_accepted`,
          `${label} uses zero tap, which Meta only allows once you accept its terms.`,
          "Set zero_tap_terms_accepted to true.",
          "BUTTONS",
        );
      }
      break;
    }
    case "FLOW": {
      if (!button.flow_id && !button.flow_name && !button.flow_json) {
        error(
          "button.flow.target",
          `${path}.flow_id`,
          `${label} does not say which flow to open.`,
          "Give it a flow id or a flow name.",
          "BUTTONS",
        );
      }
      if (button.flow_action === "navigate" && !button.navigate_screen) {
        error(
          "button.flow.screen",
          `${path}.navigate_screen`,
          `${label} navigates into the flow but names no screen.`,
          undefined,
          "BUTTONS",
        );
      }
      break;
    }
  }
}

/* -------------------------------------------------------------------- carousel */

function checkCarousel(carousel: CarouselComponent, path: string, error: Report, warn: Report): void {
  const cards = carousel.cards ?? [];
  if (cards.length === 0) {
    error("carousel.empty", `${path}.cards`, "The carousel has no cards.", undefined, "CAROUSEL");
    return;
  }
  if (cards.length > LIMITS.CARDS) {
    error(
      "carousel.count",
      `${path}.cards`,
      `${cards.length} cards, and ${LIMITS.CARDS} is the limit.`,
      undefined,
      "CAROUSEL",
    );
  }

  // Every card is rendered by the same layout, so WhatsApp requires them to
  // agree: same components in the same order, same media type, same buttons.
  const shape = (index: number) => {
    const card = cards[index];
    const header = card.components.find((c) => c.type === "HEADER") as HeaderComponent | undefined;
    const buttons = card.components.find((c) => c.type === "BUTTONS") as ButtonsComponent | undefined;
    return [
      card.components.map((c) => c.type).join(","),
      header?.format ?? "-",
      (buttons?.buttons ?? []).map((b) => b.type).join(","),
    ].join("|");
  };
  const first = shape(0);
  cards.forEach((_, index) => {
    if (index > 0 && shape(index) !== first) {
      error(
        "carousel.cards.differ",
        `${path}.cards.${index}`,
        `Card ${index + 1} is built differently from card 1.`,
        "Every card needs the same components, the same media type and the same buttons in the same order.",
        "CAROUSEL",
      );
    }
  });

  cards.forEach((card, index) => {
    const at = `${path}.cards.${index}`;
    const header = card.components.find((c) => c.type === "HEADER") as HeaderComponent | undefined;
    const body = card.components.find((c) => c.type === "BODY") as BodyComponent | undefined;
    const buttons = card.components.find((c) => c.type === "BUTTONS") as ButtonsComponent | undefined;

    if (!header) {
      error("carousel.card.header", at, `Card ${index + 1} has no image or video.`, undefined, "CAROUSEL");
    } else if (header.format !== "IMAGE" && header.format !== "VIDEO") {
      error(
        "carousel.card.header_format",
        `${at}.header`,
        `Card ${index + 1} is headed by a ${header.format}, and a card takes an image or a video.`,
        undefined,
        "CAROUSEL",
      );
    } else if (!header.example?.header_handle?.length) {
      warn(
        "carousel.card.sample",
        `${at}.header.example`,
        `Card ${index + 1} has no sample ${header.format.toLowerCase()}.`,
        undefined,
        "CAROUSEL",
      );
    }

    const text = body?.text ?? "";
    if (!text.trim()) {
      error("carousel.card.body", at, `Card ${index + 1} has no text.`, undefined, "CAROUSEL");
    } else if (text.length > LIMITS.CARD_BODY) {
      error(
        "carousel.card.body_length",
        `${at}.body.text`,
        `Card ${index + 1} is ${text.length} characters, and ${LIMITS.CARD_BODY} is the limit on a card.`,
        undefined,
        "CAROUSEL",
      );
    }

    const cardButtons = buttons?.buttons ?? [];
    if (cardButtons.length === 0) {
      error("carousel.card.buttons", at, `Card ${index + 1} has no buttons.`, undefined, "CAROUSEL");
    } else if (cardButtons.length > LIMITS.CARD_BUTTONS) {
      error(
        "carousel.card.button_count",
        `${at}.buttons`,
        `Card ${index + 1} has ${cardButtons.length} buttons, and ${LIMITS.CARD_BUTTONS} is the limit on a card.`,
        undefined,
        "CAROUSEL",
      );
    }
    cardButtons.forEach((button, b) => {
      checkButton(button, `${at}.buttons.${b}`, b, error, warn);
    });
  });
}

/* ----------------------------------------------------------- limited time offer */

function checkOffer(
  offer: LimitedTimeOfferComponent,
  path: string,
  template: Template,
  error: Report,
  warn: Report,
): void {
  const text = offer.limited_time_offer?.text ?? "";
  if (!text.trim()) {
    error("offer.text", `${path}.limited_time_offer.text`, "The offer has no label.", undefined, "LIMITED_TIME_OFFER");
  } else if (text.length > LIMITS.OFFER_TEXT) {
    error(
      "offer.text_length",
      `${path}.limited_time_offer.text`,
      `The offer label is ${text.length} characters, and ${LIMITS.OFFER_TEXT} is the limit.`,
      undefined,
      "LIMITED_TIME_OFFER",
    );
  }
  if (template.category !== "MARKETING") {
    error(
      "offer.category",
      "category",
      "A limited time offer only belongs on a marketing template.",
      undefined,
      "LIMITED_TIME_OFFER",
    );
  }
  const buttons =
    (template.components.find((c) => c.type === "BUTTONS") as ButtonsComponent | undefined)?.buttons ?? [];
  const usable = buttons.some((button) => button.type === "COPY_CODE" || button.type === "URL");
  if (!usable) {
    error(
      "offer.buttons",
      "components",
      "An offer needs a way to take it: a copy code button, or a URL button.",
      undefined,
      "LIMITED_TIME_OFFER",
    );
  }
  if (!offer.limited_time_offer?.has_expiration) {
    warn(
      "offer.expiration",
      `${path}.limited_time_offer.has_expiration`,
      "The offer shows no countdown.",
      "Turn on the expiry so the urgency is visible.",
      "LIMITED_TIME_OFFER",
    );
  }
}

/* --------------------------------------------------------------- category shape */

function checkCategoryShape(template: Template, slots: Slots, error: Report, warn: Report): void {
  if (template.category === "AUTHENTICATION") {
    if (slots.header) {
      error(
        "authentication.header",
        `components.${slots.header.index}`,
        "An authentication template has no header.",
        "Delete it.",
        "HEADER",
      );
    }
    if (slots.carousel || slots.offer) {
      error(
        "authentication.extras",
        "components",
        "An authentication template is body, footer and one OTP button, nothing else.",
        undefined,
      );
    }
    if (!slots.buttons) {
      warn(
        "authentication.button",
        "components",
        "There is no way to take the code out of the message.",
        "Add an OTP button so it can be copied or filled in.",
        "BUTTONS",
      );
    }
    if (!slots.body?.component.add_security_recommendation) {
      warn(
        "authentication.security_line",
        slots.body ? `components.${slots.body.index}.add_security_recommendation` : "components",
        'The message does not warn against sharing the code.',
        "Turn on the security recommendation.",
        "BODY",
      );
    }
  }

  if (slots.carousel) {
    for (const [name, slot] of [
      ["header", slots.header],
      ["footer", slots.footer],
      ["buttons", slots.buttons],
    ] as const) {
      if (slot) {
        error(
          "carousel.bubble",
          `components.${slot.index}`,
          `A carousel template is a line of text and then the cards, so the ${name} has nowhere to go.`,
          `Delete the ${name}, or move it onto every card.`,
        );
      }
    }
  }
}
