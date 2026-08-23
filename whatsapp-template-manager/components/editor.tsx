"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  CATEGORIES,
  LANGUAGES,
  LIMITS,
  tokens,
  type BodyComponent,
  type Button as ButtonModel,
  type ButtonType,
  type ButtonsComponent,
  type CarouselComponent,
  type Category,
  type FooterComponent,
  type HeaderComponent,
  type HeaderFormat,
  type Issue,
  type LimitedTimeOfferComponent,
  type Template,
} from "@/lib/core";
import { drop, get, nextPlaceholder, put, syncSamples } from "@/lib/edit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Every field the editor writes, in the order a message is read. */
export function Editor({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const set = (next: Template) => onChange(syncSamples(next));
  const authentication = template.category === "AUTHENTICATION";
  const carousel = get<CarouselComponent>(template, "CAROUSEL");

  return (
    <div className="space-y-6">
      <Basics template={template} issues={issues} onChange={onChange} />
      {authentication || carousel ? null : (
        <Header template={template} issues={issues} onChange={set} />
      )}
      <Body template={template} issues={issues} onChange={set} />
      {carousel ? null : <Footer template={template} issues={issues} onChange={set} />}
      {carousel ? null : <Buttons template={template} issues={issues} onChange={set} />}
      {authentication ? null : <Offer template={template} issues={issues} onChange={set} />}
      {authentication ? null : <Carousel template={template} issues={issues} onChange={set} />}
    </div>
  );
}

/* ----------------------------------------------------------------- plumbing */

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** The validator's complaints about one field, under that field. */
function Notes({ issues, path }: { issues: Issue[]; path: string }) {
  const mine = issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`));
  if (!mine.length) return null;
  return (
    <ul className="space-y-1 text-xs">
      {mine.map((issue, index) => (
        <li
          key={index}
          className={cn(
            issue.severity === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-amber-600 dark:text-amber-500",
          )}
        >
          {issue.message} {issue.fix ? <span className="opacity-70">{issue.fix}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn("text-xs tabular-nums", value.length > max ? "text-red-600" : "text-muted-foreground")}>
      {value.length} / {max}
    </span>
  );
}

/** MARKETING becomes Marketing, PHONE_NUMBER becomes Phone number. */
const title = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

const OTP_LABELS: Record<string, string> = {
  COPY_CODE: "Copy the code",
  ONE_TAP: "Fill it in with one tap",
  ZERO_TAP: "Fill it in with no tap",
};

/** The index of a component in the template, for matching validator paths. */
const at = (template: Template, type: string) =>
  `components.${template.components.findIndex((component) => component.type === type)}`;

/* ------------------------------------------------------------------- basics */

function Basics({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  return (
    <Section title="The template" hint="Name and language together are its identity on the account.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={template.name}
            placeholder="order_update"
            onChange={(event) =>
              onChange({ ...template, name: event.target.value.toLowerCase().replace(/\s+/g, "_") })
            }
          />
          <Notes issues={issues} path="name" />
        </div>
        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select
            value={template.language}
            onValueChange={(value) => onChange({ ...template, language: value as string })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(code) => `${LANGUAGES[code as string] ?? code} (${code})`}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Notes issues={issues} path="language" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={template.category}
            onValueChange={(value) => onChange({ ...template, category: value as Category })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(value) => title(value as string)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {title(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Notes issues={issues} path="category" />
        </div>
        <div className="space-y-1.5">
          <Label>Placeholders</Label>
          <Select
            value={template.parameter_format ?? "POSITIONAL"}
            onValueChange={(value) =>
              onChange({ ...template, parameter_format: value as "POSITIONAL" | "NAMED" })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) => (value === "NAMED" ? "Named" : "Numbered")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="POSITIONAL">Numbered, like {"{{1}}"}</SelectItem>
              <SelectItem value="NAMED">Named, like {"{{order_id}}"}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {template.parameter_format === "NAMED"
              ? "Values are sent by name, so adding one later does not renumber the rest."
              : "Values are sent in order. A template cannot mix the two styles."}
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- header */

const HEADER_FORMATS: HeaderFormat[] = ["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"];

function Header({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const header = get<HeaderComponent>(template, "HEADER");
  const path = at(template, "HEADER");

  return (
    <Section
      title="Header"
      hint="One line of text, or one piece of media, above the message."
      action={
        header ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(drop(template, "HEADER"))}>
            <Trash2 />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange(put(template, { type: "HEADER", format: "TEXT", text: "" }))}
          >
            <Plus />
            Add
          </Button>
        )
      }
    >
      {header ? (
        <>
          <Select
            value={header.format}
            onValueChange={(value) =>
              onChange(put(template, { type: "HEADER", format: value as HeaderFormat }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(value) => title(value as string)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HEADER_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {title(format)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {header.format === "TEXT" ? (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={header.text ?? ""}
                  placeholder="Order update"
                  onChange={(event) =>
                    onChange(put(template, { ...header, text: event.target.value }))
                  }
                />
                <Counter value={header.text ?? ""} max={LIMITS.HEADER_TEXT} />
              </div>
              {tokens(header.text ?? "").map((token, index) => (
                <div key={token} className="flex items-center gap-2">
                  <code className="text-muted-foreground w-24 shrink-0 text-xs">{`{{${token}}}`}</code>
                  <Input
                    value={header.example?.header_text?.[index] ?? ""}
                    placeholder="A sample value"
                    onChange={(event) => {
                      const values = [...(header.example?.header_text ?? [])];
                      values[index] = event.target.value;
                      onChange(put(template, { ...header, example: { header_text: values } }));
                    }}
                  />
                </div>
              ))}
            </>
          ) : header.format === "LOCATION" ? (
            <p className="text-muted-foreground text-xs">
              The place is chosen when the message is sent, so there is nothing to set here.
            </p>
          ) : (
            <Input
              value={header.example?.header_handle?.[0] ?? ""}
              placeholder="https://example.com/sample.jpg"
              onChange={(event) =>
                onChange(
                  put(template, { ...header, example: { header_handle: [event.target.value] } }),
                )
              }
            />
          )}
          <Notes issues={issues} path={path} />
        </>
      ) : null}
    </Section>
  );
}

/* --------------------------------------------------------------------- body */

function Body({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const body = get<BodyComponent>(template, "BODY") ?? { type: "BODY" as const, text: "" };
  const path = at(template, "BODY");
  const named = template.parameter_format === "NAMED";

  if (template.category === "AUTHENTICATION") {
    return (
      <Section title="Body" hint="WhatsApp writes this one. All you choose is the warning line.">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={Boolean(body.add_security_recommendation)}
            onChange={(event) =>
              onChange(
                put(template, {
                  type: "BODY",
                  add_security_recommendation: event.target.checked,
                }),
              )
            }
          />
          Add &ldquo;For your security, do not share this code.&rdquo;
        </label>
        <Notes issues={issues} path={path} />
      </Section>
    );
  }

  const text = body.text ?? "";
  const used = tokens(text);

  return (
    <Section
      title="Body"
      hint="The message. *bold*, _italic_, ~strikethrough~ and ```monospace``` all work."
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange(
              put(template, {
                ...body,
                text: `${text}${nextPlaceholder(text, named ? "NAMED" : "POSITIONAL")}`,
              }),
            )
          }
        >
          <Plus />
          Placeholder
        </Button>
      }
    >
      <Textarea
        rows={7}
        value={text}
        placeholder="Hi {{1}}, your order is on its way."
        onChange={(event) => onChange(put(template, { ...body, text: event.target.value }))}
      />
      <div className="flex justify-end">
        <Counter value={text} max={LIMITS.BODY} />
      </div>

      {used.length ? (
        <div className="space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-xs">
            Sample values. Reviewers read the message filled in, so these decide whether it makes
            sense to them.
          </p>
          {used.map((token, index) => (
            <div key={token} className="flex items-center gap-2">
              <code className="text-muted-foreground w-28 shrink-0 truncate text-xs">{`{{${token}}}`}</code>
              <Input
                value={
                  named
                    ? (body.example?.body_text_named_params?.find((p) => p.param_name === token)
                        ?.example ?? "")
                    : (body.example?.body_text?.[0]?.[index] ?? "")
                }
                placeholder="A sample value"
                onChange={(event) => {
                  if (named) {
                    const params = [...(body.example?.body_text_named_params ?? [])];
                    const found = params.findIndex((param) => param.param_name === token);
                    const entry = { param_name: token, example: event.target.value };
                    if (found >= 0) params[found] = entry;
                    else params.push(entry);
                    onChange(put(template, { ...body, example: { body_text_named_params: params } }));
                  } else {
                    const row = [...(body.example?.body_text?.[0] ?? [])];
                    row[index] = event.target.value;
                    onChange(put(template, { ...body, example: { body_text: [row] } }));
                  }
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
      <Notes issues={issues} path={path} />
    </Section>
  );
}

/* ------------------------------------------------------------------- footer */

function Footer({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const footer = get<FooterComponent>(template, "FOOTER");
  const path = at(template, "FOOTER");
  const authentication = template.category === "AUTHENTICATION";

  return (
    <Section
      title="Footer"
      hint={
        authentication
          ? "How long the code is good for. WhatsApp writes the line itself."
          : "A quiet line under the message. No placeholders."
      }
      action={
        footer ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(drop(template, "FOOTER"))}>
            <Trash2 />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChange(
                put(
                  template,
                  authentication
                    ? { type: "FOOTER", code_expiration_minutes: 10 }
                    : { type: "FOOTER", text: "" },
                ),
              )
            }
          >
            <Plus />
            Add
          </Button>
        )
      }
    >
      {footer ? (
        <>
          {authentication ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={LIMITS.CODE_EXPIRATION_MIN}
                max={LIMITS.CODE_EXPIRATION_MAX}
                value={footer.code_expiration_minutes ?? ""}
                onChange={(event) =>
                  onChange(
                    put(template, {
                      type: "FOOTER",
                      code_expiration_minutes: Number(event.target.value) || undefined,
                    }),
                  )
                }
                className="w-28"
              />
              <span className="text-muted-foreground text-sm">minutes</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={footer.text ?? ""}
                placeholder="Reply STOP to unsubscribe"
                onChange={(event) => onChange(put(template, { type: "FOOTER", text: event.target.value }))}
              />
              <Counter value={footer.text ?? ""} max={LIMITS.FOOTER} />
            </div>
          )}
          <Notes issues={issues} path={path} />
        </>
      ) : null}
    </Section>
  );
}

/* ------------------------------------------------------------------ buttons */

const BUTTON_LABELS: Record<string, string> = {
  QUICK_REPLY: "Quick reply",
  URL: "Website",
  PHONE_NUMBER: "Call",
  COPY_CODE: "Copy offer code",
  OTP: "One-time password",
  FLOW: "Flow",
  CATALOG: "Catalog",
  MPM: "Product list",
  VOICE_CALL: "Voice call",
};

const NEW_BUTTON: Record<string, ButtonModel> = {
  QUICK_REPLY: { type: "QUICK_REPLY", text: "" },
  URL: { type: "URL", text: "", url: "https://" },
  PHONE_NUMBER: { type: "PHONE_NUMBER", text: "", phone_number: "" },
  COPY_CODE: { type: "COPY_CODE", example: "" },
  OTP: { type: "OTP", otp_type: "COPY_CODE", text: "Copy code" },
  FLOW: { type: "FLOW", text: "", flow_id: "" },
  CATALOG: { type: "CATALOG", text: "See catalog" },
  MPM: { type: "MPM", text: "See items" },
  VOICE_CALL: { type: "VOICE_CALL", text: "Call us" },
};

function Buttons({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const named = template.parameter_format === "NAMED";
  const block = get<ButtonsComponent>(template, "BUTTONS");
  const path = at(template, "BUTTONS");
  const buttons = block?.buttons ?? [];
  const choices =
    template.category === "AUTHENTICATION"
      ? ["OTP"]
      : Object.keys(BUTTON_LABELS).filter((type) => type !== "OTP");

  const write = (next: ButtonModel[]) =>
    onChange(next.length ? put(template, { type: "BUTTONS", buttons: next }) : drop(template, "BUTTONS"));

  const patch = (index: number, fields: Record<string, unknown>) =>
    write(buttons.map((button, i) => (i === index ? ({ ...button, ...fields } as ButtonModel) : button)));

  return (
    <Section
      title="Buttons"
      hint="Up to ten. Quick replies have to sit together, all before or all after the rest."
      action={
        <Select value="" onValueChange={(value) => write([...buttons, NEW_BUTTON[value as string]])}>
          <SelectTrigger size="sm">
            <Plus className="size-3.5" />
            Add
          </SelectTrigger>
          <SelectContent>
            {choices.map((type) => (
              <SelectItem key={type} value={type}>
                {BUTTON_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {buttons.length === 0 ? (
        <p className="text-muted-foreground text-xs">No buttons.</p>
      ) : (
        buttons.map((button, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{BUTTON_LABELS[button.type]}</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => write(buttons.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>

            {button.type !== "COPY_CODE" ? (
              <div className="flex items-center gap-2">
                <Input
                  value={"text" in button ? (button.text ?? "") : ""}
                  placeholder="Button label"
                  onChange={(event) => patch(index, { text: event.target.value })}
                />
                <Counter value={"text" in button ? (button.text ?? "") : ""} max={LIMITS.BUTTON_TEXT} />
              </div>
            ) : null}

            {button.type === "URL" ? (
              <UrlFields
                button={button}
                named={named}
                onChange={(fields) => patch(index, fields)}
              />
            ) : null}

            {button.type === "PHONE_NUMBER" ? (
              <Input
                value={button.phone_number}
                placeholder="+15551234567"
                onChange={(event) => patch(index, { phone_number: event.target.value })}
              />
            ) : null}

            {button.type === "COPY_CODE" ? (
              <Input
                value={button.example}
                placeholder="WEEKEND20"
                onChange={(event) => patch(index, { example: event.target.value })}
              />
            ) : null}

            {button.type === "FLOW" ? (
              <Input
                value={button.flow_id ?? ""}
                placeholder="Flow id"
                onChange={(event) => patch(index, { flow_id: event.target.value })}
              />
            ) : null}

            {button.type === "OTP" ? (
              <Select
                value={button.otp_type}
                onValueChange={(value) => patch(index, { otp_type: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(value) => OTP_LABELS[value as string] ?? "Copy the code"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COPY_CODE">Copy the code</SelectItem>
                  <SelectItem value="ONE_TAP">Fill it in with one tap</SelectItem>
                  <SelectItem value="ZERO_TAP">Fill it in with no tap</SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            <Notes issues={issues} path={`${path}.buttons.${index}`} />
          </div>
        ))
      )}
      <Notes issues={issues} path={path} />
    </Section>
  );
}

/**
 * A URL button, static or dynamic.
 *
 * WhatsApp accepts one placeholder in a URL button and only at the very end:
 * `https://example.com/orders/{{1}}` is fine, `.../{{1}}/status` is refused at
 * submission with nothing useful to say. So the placeholder is not typed here,
 * it is pinned to the end of the field, and the address is stored as the
 * prefix plus that placeholder. The rule cannot be broken by hand.
 *
 * The sample is the value the placeholder stands in for, but Meta wants the
 * whole address it produces, so that is what gets stored, and what is shown
 * underneath is exactly what will be sent.
 */
function UrlFields({
  button,
  named,
  onChange,
}: {
  button: ButtonModel & { type: "URL" };
  named: boolean;
  onChange: (fields: Record<string, unknown>) => void;
}) {
  const token = tokens(button.url)[0] ?? (named ? "url" : "1");
  const dynamic = tokens(button.url).length > 0;
  const prefix = button.url.replace(/\{\{[^}]*\}\}\s*$/, "");
  const placeholder = `{{${token}}}`;
  // The stored sample is the full address, so the suffix is read back out of it.
  const sample = (button.example?.[0] ?? "").startsWith(prefix)
    ? (button.example?.[0] ?? "").slice(prefix.length)
    : (button.example?.[0] ?? "");

  const setPrefix = (next: string) => {
    onChange({
      url: dynamic ? `${next}${placeholder}` : next,
      ...(dynamic ? { example: sample ? [`${next}${sample}`] : undefined } : {}),
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="focus-within:border-ring flex flex-1 items-center rounded-lg border pr-1">
          <Input
            value={prefix}
            placeholder="https://example.com/orders/"
            onChange={(event) => setPrefix(event.target.value)}
            className="border-0 focus-visible:ring-0"
          />
          {dynamic ? (
            <code className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-1 text-xs">
              {placeholder}
            </code>
          ) : null}
        </div>
        <Select
          value={dynamic ? "dynamic" : "static"}
          onValueChange={(value) =>
            value === "dynamic"
              ? onChange({ url: `${prefix}${placeholder}`, example: undefined })
              : onChange({ url: prefix, example: undefined })
          }
        >
          <SelectTrigger className="shrink-0">
            <SelectValue>{(value) => (value === "dynamic" ? "Dynamic" : "Static")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Static</SelectItem>
            <SelectItem value="dynamic">Dynamic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dynamic ? (
        <>
          <div className="flex items-center gap-2">
            <code className="text-muted-foreground w-20 shrink-0 truncate text-xs">
              {placeholder} =
            </code>
            <Input
              value={sample}
              placeholder="What it stands in for"
              onChange={(event) =>
                onChange({ example: event.target.value ? [`${prefix}${event.target.value}`] : undefined })
              }
            />
          </div>
          {sample ? (
            <p className="text-muted-foreground truncate font-mono text-[11px]">
              {prefix}
              {sample}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------- offer */

function Offer({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const offer = get<LimitedTimeOfferComponent>(template, "LIMITED_TIME_OFFER");
  const path = at(template, "LIMITED_TIME_OFFER");

  return (
    <Section
      title="Limited time offer"
      hint="A countdown over the message. Marketing only, and it needs a code or a link to act on."
      action={
        offer ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(drop(template, "LIMITED_TIME_OFFER"))}
          >
            <Trash2 />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChange(
                put(template, {
                  type: "LIMITED_TIME_OFFER",
                  limited_time_offer: { text: "", has_expiration: true },
                }),
              )
            }
          >
            <Plus />
            Add
          </Button>
        )
      }
    >
      {offer ? (
        <>
          <div className="flex items-center gap-2">
            <Input
              value={offer.limited_time_offer.text}
              placeholder="Ends Sunday"
              onChange={(event) =>
                onChange(
                  put(template, {
                    type: "LIMITED_TIME_OFFER",
                    limited_time_offer: { ...offer.limited_time_offer, text: event.target.value },
                  }),
                )
              }
            />
            <Counter value={offer.limited_time_offer.text} max={LIMITS.OFFER_TEXT} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={Boolean(offer.limited_time_offer.has_expiration)}
              onChange={(event) =>
                onChange(
                  put(template, {
                    type: "LIMITED_TIME_OFFER",
                    limited_time_offer: {
                      ...offer.limited_time_offer,
                      has_expiration: event.target.checked,
                    },
                  }),
                )
              }
            />
            Show the countdown
          </label>
          <Notes issues={issues} path={path} />
        </>
      ) : null}
    </Section>
  );
}

/* ----------------------------------------------------------------- carousel */

function Carousel({
  template,
  issues,
  onChange,
}: {
  template: Template;
  issues: Issue[];
  onChange: (next: Template) => void;
}) {
  const carousel = get<CarouselComponent>(template, "CAROUSEL");
  const path = at(template, "CAROUSEL");

  const blankCard = (): CarouselComponent["cards"][number] => ({
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: [""] } },
      { type: "BODY", text: "" },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "See it", url: "https://" }] },
    ],
  });

  const write = (cards: CarouselComponent["cards"]) =>
    onChange(put(template, { type: "CAROUSEL", cards }));

  return (
    <Section
      title="Carousel"
      hint="Cards under the message. Every card has to be built the same way as the first."
      action={
        carousel ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => write([...carousel.cards, blankCard()])}>
              <Plus />
              Card
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(drop(template, "CAROUSEL"))}>
              <Trash2 />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange(put(template, { type: "CAROUSEL", cards: [blankCard()] }))}
          >
            <Plus />
            Add
          </Button>
        )
      }
    >
      {carousel?.cards.map((card, index) => {
        const header = card.components.find((c) => c.type === "HEADER") as HeaderComponent | undefined;
        const body = card.components.find((c) => c.type === "BODY") as BodyComponent | undefined;
        const buttons = card.components.find((c) => c.type === "BUTTONS") as ButtonsComponent | undefined;

        const patchCard = (components: typeof card.components) =>
          write(carousel.cards.map((existing, i) => (i === index ? { components } : existing)));

        const replace = (type: string, next: (typeof card.components)[number]) =>
          patchCard(card.components.map((component) => (component.type === type ? next : component)));

        return (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Card {index + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => write(carousel.cards.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>

            <Select
              value={header?.format ?? "IMAGE"}
              onValueChange={(value) =>
                replace("HEADER", { ...(header as HeaderComponent), format: value as HeaderFormat })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>{(value) => title(value as string)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IMAGE">Image</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={header?.example?.header_handle?.[0] ?? ""}
              placeholder="https://example.com/card.jpg"
              onChange={(event) =>
                replace("HEADER", {
                  ...(header as HeaderComponent),
                  example: { header_handle: [event.target.value] },
                })
              }
            />

            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                value={body?.text ?? ""}
                placeholder="What this one is."
                onChange={(event) =>
                  replace("BODY", { type: "BODY", text: event.target.value })
                }
              />
              <Counter value={body?.text ?? ""} max={LIMITS.CARD_BODY} />
            </div>

            {(buttons?.buttons ?? []).map((button, b) => (
              <div key={b} className="flex gap-2">
                <Input
                  value={"text" in button ? (button.text ?? "") : ""}
                  placeholder="Label"
                  className="w-32"
                  onChange={(event) =>
                    replace("BUTTONS", {
                      type: "BUTTONS",
                      buttons: (buttons?.buttons ?? []).map((existing, i) =>
                        i === b ? ({ ...existing, text: event.target.value } as ButtonModel) : existing,
                      ),
                    })
                  }
                />
                {button.type === "URL" ? (
                  <div className="flex-1 space-y-2">
                    <UrlFields
                      button={button}
                      named={template.parameter_format === "NAMED"}
                      onChange={(fields) =>
                        replace("BUTTONS", {
                          type: "BUTTONS",
                          buttons: (buttons?.buttons ?? []).map((existing, i) =>
                            i === b ? ({ ...existing, ...fields } as ButtonModel) : existing,
                          ),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            ))}

            <Notes issues={issues} path={`${path}.cards.${index}`} />
          </div>
        );
      })}
      <Notes issues={issues} path={path} />
    </Section>
  );
}

export type { ButtonType };
