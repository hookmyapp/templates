import type { Template } from "./types";
import { validate, type Issue } from "./validate";

/**
 * Reading a Meta rejection.
 *
 * A template comes back as `REJECTED` with a one-word reason, or a send fails
 * with a five-digit code and a sentence written for nobody. This turns either
 * one into what actually went wrong, what to change, and, when the template is
 * at hand, which field to change it in.
 *
 * The table is a starting point. Add to it as you meet new codes: each entry
 * is data, and the matcher is the only code.
 */

export interface Diagnosis {
  /** What happened, in a few words. */
  title: string;
  /** The code or reason that matched. */
  matched: string;
  /** Why WhatsApp did that. */
  cause: string;
  /** What to do, in order. */
  fix: string[];
  /**
   * Rule ids from `validate()` that catch the same thing before submission.
   * When a template is passed to `decode()`, the issues those rules produced
   * are attached, so the reason points at a field.
   */
  rules?: string[];
  /** Matching issues from the template that was passed in. */
  issues?: Issue[];
  /** True when the match came from a code, rather than a guess at the wording. */
  certain: boolean;
}

interface Entry {
  title: string;
  /** Graph API error codes, as strings. */
  codes?: string[];
  /** Template `rejected_reason` values. */
  reasons?: string[];
  /** Wording seen in the message, matched case-insensitively. */
  phrases?: RegExp[];
  cause: string;
  fix: string[];
  rules?: string[];
}

const ENTRIES: Entry[] = [
  {
    title: "The text breaks WhatsApp's formatting rules",
    codes: ["132007"],
    reasons: ["INVALID_FORMAT"],
    phrases: [
      /new-?line/i,
      /tab characters/i,
      /consecutive spaces/i,
      /format character policy/i,
    ],
    cause:
      "Somewhere in the template there is a tab, or a run of blank lines or spaces long enough that WhatsApp reads it as layout. It renders differently on every phone, so Meta refuses it.",
    fix: [
      "Replace every tab with spaces.",
      "Collapse runs of blank lines. Two newlines gives you one blank line, which is all you need.",
      "Collapse runs of spaces. Indentation does not survive the trip.",
    ],
    rules: ["format.tab", "format.newlines", "format.spaces", "header.newline"],
  },
  {
    title: "Wrong number of variables at send time",
    codes: ["132000"],
    phrases: [/number of parameters/i],
    cause:
      "The message that went out carried a different count of variables than the approved template expects. The template is fine, the send call is not.",
    fix: [
      "Count the placeholders in the approved body, header and URL button.",
      "Send exactly that many parameters, in that order.",
      "If you edited the template after approval, re-read it: the live copy is what counts.",
    ],
    rules: ["body.placeholders.gap", "body.samples"],
  },
  {
    title: "The variables are in a format the template does not use",
    codes: ["132012"],
    phrases: [/parameter format does not match/i],
    cause:
      "The template was created with named parameters and the send used numbered ones, or the other way round.",
    fix: [
      "Look at parameter_format on the approved template.",
      "Send named parameters as objects with parameter_name, and numbered ones as a plain ordered list.",
    ],
    rules: ["parameters.format", "parameters.mixed"],
  },
  {
    title: "No template by that name and language",
    codes: ["132001"],
    phrases: [/template name .*does not exist/i, /does not exist in the translation/i],
    cause:
      "A template is identified by its name and its language together. One of the two does not match anything on the WABA.",
    fix: [
      "Check the spelling of the name. It is case sensitive and always lowercase.",
      "Check the language code. A template in en is not a template in en_US.",
      "Confirm the template is APPROVED, not still in review.",
    ],
  },
  {
    title: "A translation is too long",
    codes: ["132005"],
    phrases: [/translated text is too long/i],
    cause:
      "One language of this template runs past a limit that the original stayed inside. Translations often grow by a third.",
    fix: [
      "Shorten the body of that language to 1024 characters, the header to 60, the footer to 60.",
      "Button labels are 25 characters in every language.",
    ],
    rules: ["body.length", "header.length", "footer.length", "button.text.length"],
  },
  {
    title: "Required parameter missing",
    codes: ["131008"],
    phrases: [/required parameter is missing/i],
    cause: "The send call left out something the template needs, usually a media header or a URL suffix.",
    fix: [
      "Send a header parameter for every media header.",
      "Send the URL parameter for a button whose address ends in a placeholder.",
    ],
  },
  {
    title: "A parameter value was refused",
    codes: ["131009"],
    phrases: [/parameter value is not valid/i],
    cause:
      "A value you sent is the wrong shape: an unreachable media link, a badly formed date, or text where a number belongs.",
    fix: [
      "Media links have to be public and reachable, and the type has to match the header.",
      "Check for stray newlines inside a parameter. A parameter is one line.",
    ],
  },
  {
    title: "The template is paused",
    codes: ["132015"],
    reasons: ["PAUSED"],
    phrases: [/template is paused/i],
    cause:
      "Enough people blocked or reported messages from this template that Meta stopped it. It resumes on its own, and pauses get longer each time.",
    fix: [
      "Stop sending it. Sending into a pause makes the next one longer.",
      "Read the quality score on the template for what people objected to.",
      "Rewrite the message before you turn it back on, and re-check the audience.",
    ],
  },
  {
    title: "The template is disabled",
    codes: ["132016"],
    reasons: ["DISABLED"],
    phrases: [/template is disabled/i],
    cause: "The template was paused repeatedly and is now off for good. It will not come back.",
    fix: [
      "Write a new template with a different message, not a renamed copy of this one.",
      "Look at why people objected first, or the new one goes the same way.",
    ],
  },
  {
    title: "A template with that name already exists",
    phrases: [/already exists/i, /template_exists/i],
    cause: "Name and language together have to be unique on a WABA, and this pair is taken.",
    fix: [
      "Edit the existing template instead of creating it again.",
      "Or pick a new name. Version suffixes like _v2 are the usual way.",
    ],
  },
  {
    title: "The buttons cannot go together",
    phrases: [/invalid.*component/i, /button.*combination/i],
    cause:
      "Some buttons are exclusive. Quick replies have to sit in one unbroken run, a catalog or product-list button has to be alone, and an authentication template takes an OTP button and nothing else.",
    fix: [
      "Group the quick replies together, all before or all after the other buttons.",
      "Leave a catalog or product-list button on its own.",
      "Keep OTP buttons on authentication templates only.",
    ],
    rules: [
      "buttons.quick_reply.grouped",
      "buttons.exclusive",
      "buttons.otp.category",
      "buttons.authentication.only_otp",
    ],
  },
  {
    title: "The category does not match the message",
    reasons: ["INCORRECT_CATEGORY", "TAG_CONTENT_MISMATCH"],
    phrases: [/incorrect_category/i, /tag_content_mismatch/i],
    cause:
      "The template was filed as utility or authentication but reads like marketing. Anything that promotes, invites or upsells is marketing, however it is phrased.",
    fix: [
      "Move it to MARKETING and accept the higher price, or",
      "Strip the promotion out until it is only the transactional fact the customer asked for.",
      "A utility message follows something the customer did. If it does not, it is not utility.",
    ],
    rules: ["offer.category"],
  },
  {
    title: "Read as abusive or as a scam",
    reasons: ["ABUSIVE_CONTENT", "SCAM"],
    phrases: [/abusive_content/i, /\bscam\b/i],
    cause:
      "The wording tripped Meta's fraud read: a threat, an urgent demand, a prize, a login link, or the name of a company that is not yours.",
    fix: [
      "Take out the urgency and the threat. No account closures, no last chances.",
      "Do not name a brand you do not own, and do not imitate a bank or a courier.",
      "Send people to a domain you own. Shortened links read as evasion.",
      "Say who is writing in the first line.",
    ],
  },
  {
    title: "The flow is blocked",
    codes: ["132068"],
    phrases: [/flow is blocked/i],
    cause: "The flow behind the button is failing health checks, so WhatsApp will not open it.",
    fix: [
      "Open the flow in WhatsApp Manager and read its status.",
      "A data-exchange flow needs its endpoint answering. Check the endpoint before you resend.",
    ],
    rules: ["button.flow.target", "button.flow.screen"],
  },
  {
    title: "The flow is throttled",
    codes: ["132069"],
    phrases: [/flow is throttled/i],
    cause: "Too many sends of this flow in too short a window.",
    fix: ["Slow the send rate and retry.", "Spread a campaign over a longer period."],
  },
];

const CODE_PATTERN = /\b(1[0-9]{5}|2[0-9]{6})\b/g;

/**
 * Read a rejection. `input` can be the whole JSON error body, a pasted
 * sentence, or a bare `rejected_reason` like `INCORRECT_CATEGORY`.
 *
 * Pass the template too and every diagnosis comes back with the matching
 * validation issues attached, so the answer points at a field instead of a
 * paragraph.
 */
export function decode(input: string, template?: Template): Diagnosis[] {
  const text = input.trim();
  if (!text) return [];

  const codes = new Set(text.match(CODE_PATTERN) ?? []);
  const issues = template ? validate(template).issues : [];

  const found: Diagnosis[] = [];
  for (const entry of ENTRIES) {
    const code = entry.codes?.find((value) => codes.has(value));
    const reason = entry.reasons?.find((value) => new RegExp(`\\b${value}\\b`, "i").test(text));
    const phrase = entry.phrases?.find((pattern) => pattern.test(text));
    if (!code && !reason && !phrase) continue;

    found.push({
      title: entry.title,
      matched: code ?? reason ?? phrase!.source,
      cause: entry.cause,
      fix: entry.fix,
      rules: entry.rules,
      issues: entry.rules ? issues.filter((issue) => entry.rules!.includes(issue.rule)) : [],
      certain: Boolean(code || reason),
    });
  }

  // A code we have never seen still deserves an answer, and the template's own
  // errors are the likeliest explanation.
  if (found.length === 0) {
    const blocking = issues.filter((issue) => issue.severity === "error");
    found.push({
      title: "Not a message we recognise",
      matched: [...codes][0] ?? "no code found",
      cause: blocking.length
        ? "Nothing in the table matches this, but the template does not pass its own checks, and that is the place to start."
        : "Nothing in the table matches this, and the template passes every check we know about.",
      fix: blocking.length
        ? blocking.slice(0, 5).map((issue) => issue.message)
        : [
            "Read the error next to error_user_title and error_user_msg in the response. Those are written for people.",
            "Submit the template again unchanged. A share of create-time failures are transient.",
            "Add the code to lib/core/decode.ts once you know what it meant, so the next person does not have to work it out.",
          ],
      issues: blocking,
      certain: false,
    });
  }

  return found;
}
