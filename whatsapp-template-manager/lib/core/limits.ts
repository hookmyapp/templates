import type { Category } from "./types";

/**
 * The counts and lengths Meta enforces on a message template.
 *
 * Every number here is a rejection waiting to happen, so each one is checked
 * in `validate()` rather than left for the API to find.
 */
export const LIMITS = {
  NAME: 512,
  BODY: 1024,
  HEADER_TEXT: 60,
  FOOTER: 60,
  BUTTON_TEXT: 25,
  URL: 2000,
  PHONE_NUMBER: 20,
  COPY_CODE: 15,
  OFFER_TEXT: 16,

  BUTTONS: 10,
  URL_BUTTONS: 2,
  PHONE_BUTTONS: 1,
  QUICK_REPLY_BUTTONS: 10,
  COPY_CODE_BUTTONS: 1,
  OTP_BUTTONS: 1,
  FLOW_BUTTONS: 1,

  /** Carousels hold between 1 and 10 cards. */
  CARDS: 10,
  CARD_BODY: 160,
  CARD_BUTTONS: 2,

  /** Authentication code lifetime, in minutes. */
  CODE_EXPIRATION_MIN: 1,
  CODE_EXPIRATION_MAX: 90,
} as const;

/** Lowercase letters, digits and underscores. */
export const NAME_PATTERN = /^[a-z0-9_]+$/;

/** A named parameter: lowercase letters, digits and underscores. */
export const PARAM_NAME_PATTERN = /^[a-z0-9_]+$/;

export const CATEGORIES: readonly Category[] = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
];

/**
 * Characters Meta's format check rejects. These surface as error 132007
 * ("template format character policy violated") long after approval, at send
 * time, which makes them worth catching while the template is being written.
 */
export const FORMAT_RULES = [
  { id: "tab", pattern: /\t/, label: "a tab character" },
  { id: "newlines", pattern: /\n{5,}/, label: "five or more newlines in a row" },
  { id: "spaces", pattern: / {5,}/, label: "five or more spaces in a row" },
] as const;
