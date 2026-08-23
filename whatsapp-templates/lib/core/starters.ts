import type { Template } from "./types";

export interface Starter {
  id: string;
  title: string;
  /** What it is for, and when to reach for it. */
  about: string;
  template: Template;
}

/**
 * Templates to start from. Every one of them passes `validate()` with no
 * errors, which the test suite asserts, so a starter is never the reason a
 * submission comes back.
 */
export const STARTERS: Starter[] = [
  {
    id: "welcome",
    title: "Welcome",
    about: "The first message after someone opts in. Marketing, because it sells nothing but is not a receipt either.",
    template: {
      name: "welcome_message",
      language: "en_US",
      category: "MARKETING",
      components: [
        { type: "HEADER", format: "TEXT", text: "Welcome" },
        {
          type: "BODY",
          text: "Hi {{1}}, thanks for joining {{2}}. Write back whenever you need a hand, this number is read by a person.",
          example: { body_text: [["Sam", "Acme"]] },
        },
        { type: "FOOTER", text: "Reply STOP to unsubscribe" },
      ],
    },
  },
  {
    id: "order_update",
    title: "Order update",
    about: "A status change on something the customer bought. Utility, and the cheapest category to send.",
    template: {
      name: "order_update",
      language: "en_US",
      category: "UTILITY",
      components: [
        { type: "HEADER", format: "TEXT", text: "Order update" },
        {
          type: "BODY",
          text: "Hi {{1}}, order {{2}} is now {{3}}. We will write again when it moves.",
          example: { body_text: [["Sam", "A-1024", "out for delivery"]] },
        },
        { type: "FOOTER", text: "Reply STOP to unsubscribe" },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Track order",
              url: "https://example.com/orders/{{1}}",
              example: ["https://example.com/orders/A-1024"],
            },
          ],
        },
      ],
    },
  },
  {
    id: "verification_code",
    title: "Verification code",
    about:
      "A one-time code. WhatsApp writes the wording itself, which is why the body is empty. All you choose is how the code leaves the message.",
    template: {
      name: "verification_code",
      language: "en_US",
      category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: 10 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy code" }] },
      ],
    },
  },
  {
    id: "appointment_reminder",
    title: "Appointment reminder",
    about: "Named parameters, so the send call reads like the message rather than a numbered list.",
    template: {
      name: "appointment_reminder",
      language: "en_US",
      category: "UTILITY",
      parameter_format: "NAMED",
      components: [
        {
          type: "BODY",
          text: "Hi {{name}}, your appointment is on {{date}} at {{time}}. Reply CHANGE if that no longer works.",
          example: {
            body_text_named_params: [
              { param_name: "name", example: "Sam" },
              { param_name: "date", example: "Tuesday 4 March" },
              { param_name: "time", example: "10:30" },
            ],
          },
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Confirm" },
            { type: "QUICK_REPLY", text: "Reschedule" },
          ],
        },
      ],
    },
  },
  {
    id: "product_carousel",
    title: "Product carousel",
    about: "A line of text and then cards people swipe through. Every card has to be built the same way.",
    template: {
      name: "product_carousel",
      language: "en_US",
      category: "MARKETING",
      components: [
        {
          type: "BODY",
          text: "Hi {{1}}, here is what came in this week. Swipe to see the rest.",
          example: { body_text: [["Sam"]] },
        },
        {
          type: "CAROUSEL",
          cards: [
            {
              components: [
                {
                  type: "HEADER",
                  format: "IMAGE",
                  example: { header_handle: ["https://example.com/one.jpg"] },
                },
                { type: "BODY", text: "The first one, back in stock and going quickly." },
                {
                  type: "BUTTONS",
                  buttons: [
                    { type: "URL", text: "See it", url: "https://example.com/p/one" },
                    { type: "QUICK_REPLY", text: "Save for later" },
                  ],
                },
              ],
            },
            {
              components: [
                {
                  type: "HEADER",
                  format: "IMAGE",
                  example: { header_handle: ["https://example.com/two.jpg"] },
                },
                { type: "BODY", text: "The second one, new this week and made to order." },
                {
                  type: "BUTTONS",
                  buttons: [
                    { type: "URL", text: "See it", url: "https://example.com/p/two" },
                    { type: "QUICK_REPLY", text: "Save for later" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "limited_time_offer",
    title: "Limited time offer",
    about: "A code with a countdown on it. Marketing only, and it needs an image or a video above the text.",
    template: {
      name: "limited_time_offer",
      language: "en_US",
      category: "MARKETING",
      components: [
        {
          type: "HEADER",
          format: "IMAGE",
          example: { header_handle: ["https://example.com/offer.jpg"] },
        },
        {
          type: "BODY",
          text: "Hi {{1}}, this weekend is 20 percent off everything. The code below does it at checkout.",
          example: { body_text: [["Sam"]] },
        },
        {
          type: "LIMITED_TIME_OFFER",
          limited_time_offer: { text: "Ends Sunday", has_expiration: true },
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "COPY_CODE", example: "WEEKEND20" },
            { type: "URL", text: "Shop now", url: "https://example.com/sale" },
          ],
        },
      ],
    },
  },
];

/** A fresh copy, so an editor can change it without touching the original. */
export function starter(id: string): Template | undefined {
  const found = STARTERS.find((entry) => entry.id === id);
  return found ? structuredClone(found.template) : undefined;
}

/** An empty template to build from. */
export function blank(): Template {
  return {
    name: "",
    language: "en_US",
    category: "UTILITY",
    components: [{ type: "BODY", text: "" }],
  };
}
