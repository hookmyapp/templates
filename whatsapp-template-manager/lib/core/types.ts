/**
 * The WhatsApp message-template model.
 *
 * These types are the shape Meta's Cloud API expects at
 * `POST /{waba-id}/message_templates`. A template that passes `validate()` is
 * the request body, with nothing to map or rename on the way out.
 */

export type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";

/** Positional templates use `{{1}}`; named templates use `{{order_id}}`. */
export type ParameterFormat = "POSITIONAL" | "NAMED";

export type HeaderFormat = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

/** One sample value for a named parameter. */
export interface NamedParam {
  param_name: string;
  example: string;
}

export interface HeaderComponent {
  type: "HEADER";
  format: HeaderFormat;
  /** Only when `format` is `TEXT`. At most one variable. */
  text?: string;
  example?: {
    /** Sample for a text header's single variable. */
    header_text?: string[];
    header_text_named_params?: NamedParam[];
    /** Media handle from the resumable upload API, or a public URL. */
    header_handle?: string[];
  };
}

export interface BodyComponent {
  type: "BODY";
  /** Omitted for an AUTHENTICATION body, because Meta writes that text itself. */
  text?: string;
  /** AUTHENTICATION only: appends "For your security, do not share this code." */
  add_security_recommendation?: boolean;
  example?: {
    /** One row of samples, one entry per variable, for positional templates. */
    body_text?: string[][];
    body_text_named_params?: NamedParam[];
  };
}

export interface FooterComponent {
  type: "FOOTER";
  /** Omitted for an AUTHENTICATION footer, because the expiry line is generated. */
  text?: string;
  /** AUTHENTICATION only: 1-90. Renders "Expires in N minutes." */
  code_expiration_minutes?: number;
}

/** An Android app that may auto-fill a one-tap authentication code. */
export interface SupportedApp {
  package_name: string;
  signature_hash: string;
}

export type Button =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; example: string }
  | { type: "VOICE_CALL"; text: string }
  | { type: "CATALOG"; text: string }
  | { type: "MPM"; text: string }
  | {
      type: "FLOW";
      text: string;
      flow_id?: string;
      flow_name?: string;
      flow_json?: string;
      flow_action?: "navigate" | "data_exchange";
      navigate_screen?: string;
    }
  | {
      type: "OTP";
      otp_type: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
      /** Button label. Meta supplies a default when omitted. */
      text?: string;
      /** ONE_TAP / ZERO_TAP: label shown while the code is auto-filled. */
      autofill_text?: string;
      supported_apps?: SupportedApp[];
      zero_tap_terms_accepted?: boolean;
    };

export type ButtonType = Button["type"];

export interface ButtonsComponent {
  type: "BUTTONS";
  buttons: Button[];
}

/** One card in a carousel. Every card must share the same shape. */
export interface CarouselCard {
  components: Array<HeaderComponent | BodyComponent | ButtonsComponent>;
}

export interface CarouselComponent {
  type: "CAROUSEL";
  cards: CarouselCard[];
}

/** A marketing offer with a countdown. Needs a copy-code or URL button. */
export interface LimitedTimeOfferComponent {
  type: "LIMITED_TIME_OFFER";
  limited_time_offer: {
    /** Offer label, at most 16 characters. */
    text: string;
    /** Show the countdown to the expiry passed at send time. */
    has_expiration?: boolean;
  };
}

export type Component =
  | HeaderComponent
  | BodyComponent
  | FooterComponent
  | ButtonsComponent
  | CarouselComponent
  | LimitedTimeOfferComponent;

export type ComponentType = Component["type"];

export interface Template {
  /** Lowercase letters, digits and underscores. */
  name: string;
  /** A code from `LANGUAGES`, e.g. `en_US`. */
  language: string;
  category: Category;
  /** Defaults to `POSITIONAL` when absent. */
  parameter_format?: ParameterFormat;
  components: Component[];
}

/** What Meta reports back about a template that already exists on a WABA. */
export type TemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "PENDING_DELETION";

/** A template as it comes back from `GET /{waba-id}/message_templates`. */
export interface LiveTemplate extends Template {
  id: string;
  status: TemplateStatus;
  /** Present when `status` is `REJECTED`. */
  rejected_reason?: string;
  quality_score?: { score?: string; reasons?: string[] };
}
