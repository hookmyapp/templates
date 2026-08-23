"use client";

import { useState } from "react";

import {
  BadgeCheck,
  ChevronLeft,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MapPin,
  Phone,
  Reply,
  ShoppingBag,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RTL, bodySamples, fill, headerSamples, toHtml } from "@/lib/core";
import type {
  BodyComponent,
  ButtonsComponent,
  Button as ButtonModel,
  CarouselComponent,
  FooterComponent,
  HeaderComponent,
  LimitedTimeOfferComponent,
  Template,
} from "@/lib/core";

/**
 * The message as WhatsApp draws it.
 *
 * The colours and the geometry are sampled from the WhatsApp UI Kit (iOS),
 * the same source the marketing screens are rebuilt from: chat #EFE7DE,
 * incoming bubble white with a 9px radius squared off to 2px at the corner it
 * points from, timestamps #7d8a80, actionable text #007AFF. The wallpaper is
 * drawn here rather than exported, so nothing in this repo comes out of a
 * community file.
 *
 * Text goes through `toHtml`, which escapes before it formats, so a sample
 * value pulled off a WABA cannot put markup on the page.
 */
export function Preview({
  template,
  className,
  chrome = false,
  business = "Your business",
}: {
  template: Template;
  className?: string;
  /** Draw the thread around the message: header bar, name, verified tick. */
  chrome?: boolean;
  business?: string;
}) {
  const find = <T,>(type: string) =>
    template.components.find((component) => component.type === type) as T | undefined;

  const header = find<HeaderComponent>("HEADER");
  const body = find<BodyComponent>("BODY");
  const footer = find<FooterComponent>("FOOTER");
  const buttons = find<ButtonsComponent>("BUTTONS");
  const carousel = find<CarouselComponent>("CAROUSEL");
  const offer = find<LimitedTimeOfferComponent>("LIMITED_TIME_OFFER");
  const rtl = RTL.has(template.language.split("_")[0]);

  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      {chrome ? <Thread name={business} /> : null}
      <div
        className="bg-[#efe7de] p-3 dark:bg-[#0b141a]"
        style={{ backgroundImage: WALLPAPER, backgroundSize: "260px" }}
        dir={rtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto w-full max-w-[340px] space-y-1.5">
        <Bubble>
          <Header header={header} />
          {offer ? <Offer offer={offer} /> : null}
          <Body body={body} template={template} />
          <Footer footer={footer} template={template} />
        </Bubble>

          {buttons?.buttons?.length ? <Buttons buttons={buttons.buttons} /> : null}
          {carousel ? <Carousel carousel={carousel} /> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The doodle wallpaper, drawn rather than exported. A few faint outlines at
 * the density the real one sits at, which is all the eye reads at this size.
 */
const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" fill="none" stroke="#000" stroke-opacity=".045" stroke-width="1.6">
    <path d="M18 30h26a4 4 0 014 4v14a4 4 0 01-4 4H30l-8 7v-7h-4a4 4 0 01-4-4V34a4 4 0 014-4z"/>
    <circle cx="112" cy="42" r="11"/><path d="M112 36v7l5 3"/>
    <path d="M186 28l7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z"/>
    <path d="M46 122c0 9 7 16 16 16s16-7 16-16"/><path d="M62 138v12"/><path d="M54 150h16"/>
    <rect x="128" y="112" width="30" height="38" rx="4"/><path d="M136 122h14M136 130h14M136 138h8"/>
    <path d="M212 116l12 12-12 12-12-12z"/>
    <path d="M24 202a12 12 0 1124 0 12 12 0 01-24 0z"/><path d="M36 190v-8"/>
    <path d="M96 196h28a4 4 0 014 4v16a4 4 0 01-4 4h-10l-6 6v-6h-12a4 4 0 01-4-4v-16a4 4 0 014-4z"/>
    <path d="M188 200l10 18h-20z"/><path d="M188 224v6"/>
  </svg>`,
)}")`;

/** The thread the message would arrive in, so the bubble is not floating. */
function Thread({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#d8d8d8] bg-[#f6f6f6] px-3 py-2 dark:border-[#222d34] dark:bg-[#202c33]">
      <ChevronLeft className="size-4 text-[#007aff]" />
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#00a884] text-[11px] font-semibold text-white">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[13px] font-semibold leading-tight">
          <span className="truncate">{name}</span>
          <BadgeCheck className="size-3 shrink-0 text-[#00a884]" />
        </span>
        <span className="text-[10.5px] leading-tight text-[#667781] dark:text-[#8696a0]">
          business account
        </span>
      </span>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[9px] rounded-tl-[2px] bg-white px-2 pb-1.5 pt-2 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_1px_rgba(0,0,0,0.11)] dark:bg-[#202c33] dark:text-[#e9edef]">
      {children}
      <span className="float-right ml-2 mt-1 text-[11px] leading-none text-[#7d8a80] dark:text-[#8696a0]">
        10:24
      </span>
    </div>
  );
}

const MEDIA_ICON = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  DOCUMENT: FileText,
  LOCATION: MapPin,
} as const;

function Header({ header }: { header?: HeaderComponent }) {
  const [broken, setBroken] = useState(false);
  const samples = headerSamples(header);
  if (!header) return null;

  if (header.format === "TEXT") {
    if (!header.text) return null;
    return (
      <div
        className="mb-1 font-semibold"
        dangerouslySetInnerHTML={{ __html: toHtml(fill(header.text, samples)) }}
      />
    );
  }

  const Icon = MEDIA_ICON[header.format];
  const preview = header.example?.header_handle?.[0];
  const isUrl = preview?.startsWith("http") && !broken;

  return (
    <div className="mb-1.5 flex h-36 items-center justify-center overflow-hidden rounded-md bg-[#ccd0d5] text-[#54656f] dark:bg-[#111b21] dark:text-[#8696a0]">
      {isUrl && header.format === "IMAGE" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-xs">
          <Icon className="size-7" />
          <span className="uppercase tracking-wide">{header.format}</span>
        </div>
      )}
    </div>
  );
}

function Body({ body, template }: { body?: BodyComponent; template: Template }) {
  const samples = bodySamples(body);
  // WhatsApp writes the text of an authentication message itself, so the
  // preview has to write it too, or it shows an empty bubble for the one
  // template type where the wording is fixed.
  if (template.category === "AUTHENTICATION") {
    const code = "123456";
    return (
      <div>
        <span className="font-bold">{code}</span> is your verification code.
        {body?.add_security_recommendation ? " For your security, do not share this code." : null}
      </div>
    );
  }
  if (!body?.text) {
    return <div className="text-[#8696a0] italic">Nothing written yet</div>;
  }
  return (
    <div
      className="whitespace-pre-wrap [&_code]:font-mono [&_code]:text-[13px]"
      dangerouslySetInnerHTML={{ __html: toHtml(fill(body.text, samples)) }}
    />
  );
}

function Footer({ footer, template }: { footer?: FooterComponent; template: Template }) {
  if (!footer) return null;
  const text =
    template.category === "AUTHENTICATION"
      ? footer.code_expiration_minutes
        ? `This code expires in ${footer.code_expiration_minutes} minutes.`
        : null
      : footer.text;
  if (!text) return null;
  return <div className="mt-1.5 text-[13px] text-[#667781] dark:text-[#8696a0]">{text}</div>;
}

function Offer({ offer }: { offer: LimitedTimeOfferComponent }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-[#d9fdd3] px-2 py-1.5 text-[13px] font-medium text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
      <Clock className="size-3.5" />
      {offer.limited_time_offer.text || "Offer"}
      {offer.limited_time_offer.has_expiration ? (
        <span className="ml-auto tabular-nums opacity-70">11:59:42</span>
      ) : null}
    </div>
  );
}

const BUTTON_ICON: Partial<Record<ButtonModel["type"], typeof Reply>> = {
  QUICK_REPLY: Reply,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  OTP: Copy,
  CATALOG: ShoppingBag,
  MPM: ShoppingBag,
  VOICE_CALL: Phone,
};

function label(button: ButtonModel): string {
  if (button.type === "COPY_CODE") return "Copy offer code";
  if (button.type === "OTP") return button.text || "Copy code";
  return button.text || button.type.toLowerCase().replace(/_/g, " ");
}

function Buttons({ buttons }: { buttons: ButtonModel[] }) {
  return (
    <div className="space-y-1.5">
      {buttons.map((button, index) => {
        const Icon = BUTTON_ICON[button.type] ?? Reply;
        return (
          <div
            key={index}
            className="flex items-center justify-center gap-1.5 rounded-[9px] bg-white py-2 text-[14px] font-medium text-[#007aff] shadow-[0_1px_1px_rgba(0,0,0,0.11)] dark:bg-[#202c33] dark:text-[#53bdeb]"
          >
            <Icon className="size-4" />
            {label(button)}
          </div>
        );
      })}
    </div>
  );
}

function Carousel({ carousel }: { carousel: CarouselComponent }) {
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {carousel.cards.map((card, index) => {
        const header = card.components.find((c) => c.type === "HEADER") as HeaderComponent | undefined;
        const body = card.components.find((c) => c.type === "BODY") as BodyComponent | undefined;
        const buttons = card.components.find((c) => c.type === "BUTTONS") as ButtonsComponent | undefined;
        return (
          <div key={index} className="w-[210px] shrink-0 snap-start space-y-1.5">
            <div className="overflow-hidden rounded-[9px] bg-white p-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.11)] dark:bg-[#202c33]">
              <Header header={header} />
              {body?.text ? (
                <div
                  className="px-0.5 pb-1 text-[13.5px] leading-[18px] text-[#111b21] dark:text-[#e9edef]"
                  dangerouslySetInnerHTML={{ __html: toHtml(fill(body.text, bodySamples(body))) }}
                />
              ) : null}
            </div>
            {buttons?.buttons?.length ? <Buttons buttons={buttons.buttons} /> : null}
          </div>
        );
      })}
    </div>
  );
}
