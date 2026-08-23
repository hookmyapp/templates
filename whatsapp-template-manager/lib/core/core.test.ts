import { describe, expect, it } from "vitest";
import { STARTERS, blank } from "./starters";
import { validate } from "./validate";
import { decode } from "./decode";
import { toHtml } from "./format";
import { fill, formatOf } from "./variables";
import type { Template } from "./types";

/** A valid utility template, for tests that break one thing at a time. */
const base = (): Template => ({
  name: "test_template",
  language: "en_US",
  category: "UTILITY",
  components: [
    {
      type: "BODY",
      text: "Hi {{1}}, order {{2}} has shipped. We will write again when it lands.",
      example: { body_text: [["Sam", "A-1"]] },
    },
  ],
});

const rules = (template: Template) => validate(template).errors.map((issue) => issue.rule);

describe("starters", () => {
  for (const starter of STARTERS) {
    it(`${starter.id} passes review`, () => {
      const result = validate(starter.template);
      expect(result.errors, `${starter.id}: ${result.errors.map((e) => e.message).join(" | ")}`).toEqual([]);
    });
  }

  it("a blank template asks for a name and a body", () => {
    expect(rules(blank())).toContain("name.missing");
    expect(rules(blank())).toContain("body.empty");
  });
});

describe("names and placeholders", () => {
  it("refuses capitals and spaces in a name", () => {
    const template = { ...base(), name: "Order Update" };
    expect(rules(template)).toContain("name.characters");
  });

  it("refuses a gap in the numbering", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi {{1}}, order {{3}} shipped today." };
    expect(rules(template)).toContain("body.placeholders.gap");
  });

  it("refuses a body that opens or closes on a placeholder", () => {
    const opens = base();
    opens.components[0] = { type: "BODY", text: "{{1}} your order shipped today." };
    expect(rules(opens)).toContain("placeholders.start");

    const closes = base();
    closes.components[0] = { type: "BODY", text: "Your order is now {{1}}" };
    expect(rules(closes)).toContain("placeholders.end");
  });

  it("refuses two placeholders in a row", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi {{1}} {{2}}, that order shipped today." };
    expect(rules(template)).toContain("placeholders.adjacent");
  });

  it("refuses a mix of numbered and named", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi {{1}}, order {{order_id}} shipped today." };
    expect(rules(template)).toContain("parameters.mixed");
  });

  it("refuses named placeholders on a numbered template", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi {{name}}, that order shipped today." };
    expect(rules(template)).toContain("parameters.format");
  });

  it("reads the format of a piece of text", () => {
    expect(formatOf("Hi {{1}}")).toBe("POSITIONAL");
    expect(formatOf("Hi {{name}}")).toBe("NAMED");
    expect(formatOf("Hi there")).toBe("none");
  });

  it("leaves a placeholder visible when there is no sample for it", () => {
    expect(fill("Hi {{1}}, order {{2}}", { "1": "Sam" })).toBe("Hi Sam, order {{2}}");
  });
});

describe("formatting Meta rejects late", () => {
  it("catches a tab", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi there,\tyour order shipped today." };
    expect(rules(template)).toContain("format.tab");
  });

  it("catches a run of blank lines", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi there.\n\n\n\n\nYour order shipped." };
    expect(rules(template)).toContain("format.newlines");
  });
});

describe("buttons", () => {
  it("refuses a placeholder in the middle of a URL", () => {
    const template = base();
    template.components.push({
      type: "BUTTONS",
      buttons: [{ type: "URL", text: "Track", url: "https://example.com/{{1}}/status" }],
    });
    expect(rules(template)).toContain("button.url.placeholder_position");
  });

  it("accepts a placeholder at the end of a URL", () => {
    const template = base();
    template.components.push({
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Track", url: "https://example.com/orders/{{1}}", example: ["https://example.com/orders/A-1"] },
      ],
    });
    expect(rules(template)).toEqual([]);
  });

  it("refuses quick replies split up by another button", () => {
    const template = base();
    template.components.push({
      type: "BUTTONS",
      buttons: [
        { type: "QUICK_REPLY", text: "Yes" },
        { type: "URL", text: "Track", url: "https://example.com" },
        { type: "QUICK_REPLY", text: "No" },
      ],
    });
    expect(rules(template)).toContain("buttons.quick_reply.grouped");
  });

  it("accepts the same quick replies grouped together", () => {
    const template = base();
    template.components.push({
      type: "BUTTONS",
      buttons: [
        { type: "QUICK_REPLY", text: "Yes" },
        { type: "QUICK_REPLY", text: "No" },
        { type: "URL", text: "Track", url: "https://example.com" },
      ],
    });
    expect(rules(template)).toEqual([]);
  });

  it("keeps a catalog button on its own", () => {
    const template = base();
    template.components.push({
      type: "BUTTONS",
      buttons: [
        { type: "CATALOG", text: "See catalog" },
        { type: "QUICK_REPLY", text: "Not now" },
      ],
    });
    expect(rules(template)).toContain("buttons.exclusive");
  });
});

describe("authentication", () => {
  it("refuses body text, because WhatsApp writes it", () => {
    const template: Template = {
      name: "code",
      language: "en_US",
      category: "AUTHENTICATION",
      components: [{ type: "BODY", text: "Your code is {{1}}." }],
    };
    expect(rules(template)).toContain("body.authentication.text");
  });

  it("refuses a header", () => {
    const template: Template = {
      name: "code",
      language: "en_US",
      category: "AUTHENTICATION",
      components: [
        { type: "HEADER", format: "TEXT", text: "Your code" },
        { type: "BODY", add_security_recommendation: true },
      ],
    };
    expect(rules(template)).toContain("authentication.header");
  });

  it("refuses an OTP button anywhere else", () => {
    const template = base();
    template.components.push({
      type: "BUTTONS",
      buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy" }],
    });
    expect(rules(template)).toContain("buttons.otp.category");
  });

  it("wants the apps named for a one-tap code", () => {
    const template: Template = {
      name: "code",
      language: "en_US",
      category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: 10 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "ONE_TAP", text: "Autofill" }] },
      ],
    };
    expect(rules(template)).toContain("button.otp.apps");
  });

  it("holds a code lifetime to 90 minutes", () => {
    const template: Template = {
      name: "code",
      language: "en_US",
      category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: 240 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy" }] },
      ],
    };
    expect(rules(template)).toContain("footer.expiry.range");
  });
});

describe("carousel", () => {
  it("refuses cards built differently from each other", () => {
    const template = structuredClone(STARTERS.find((s) => s.id === "product_carousel")!.template);
    const carousel = template.components.find((c) => c.type === "CAROUSEL")!;
    if (carousel.type !== "CAROUSEL") throw new Error("expected a carousel");
    carousel.cards[1].components = carousel.cards[1].components.filter((c) => c.type !== "BUTTONS");
    expect(rules(template)).toContain("carousel.cards.differ");
  });

  it("leaves no room for a footer beside the cards", () => {
    const template = structuredClone(STARTERS.find((s) => s.id === "product_carousel")!.template);
    template.components.push({ type: "FOOTER", text: "Reply STOP to unsubscribe" });
    expect(rules(template)).toContain("carousel.bubble");
  });
});

describe("preview text", () => {
  it("escapes before it formats, so a sample cannot inject markup", () => {
    expect(toHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(toHtml("say *this* now")).toBe("say <b>this</b> now");
    expect(toHtml("a\nb")).toBe("a<br>b");
  });

  it("leaves a lone asterisk alone", () => {
    expect(toHtml("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});

describe("decoding a rejection", () => {
  it("reads a format code and points at the field", () => {
    const template = base();
    template.components[0] = { type: "BODY", text: "Hi there,\tyour order shipped." };
    const [first] = decode('{"error":{"code":132007,"message":"Template format character policy violated"}}', template);
    expect(first.certain).toBe(true);
    expect(first.rules).toContain("format.tab");
    expect(first.issues?.map((issue) => issue.rule)).toContain("format.tab");
  });

  it("reads a one-word rejection reason", () => {
    const [first] = decode("INCORRECT_CATEGORY");
    expect(first.title).toMatch(/category/i);
  });

  it("falls back to the template's own errors when nothing matches", () => {
    const template = base();
    template.name = "Not A Name";
    const [first] = decode("something we have never seen", template);
    expect(first.certain).toBe(false);
    expect(first.issues?.map((issue) => issue.rule)).toContain("name.characters");
  });
});
