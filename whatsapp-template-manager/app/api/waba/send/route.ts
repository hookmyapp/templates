import { NextResponse } from "next/server";
import { connection, send, WabaError } from "@/lib/waba";
import type { Template } from "@/lib/core";

/** Send an approved template to one number, to see how it really renders. */
export async function POST(request: Request) {
  const account = connection();
  if (!account) {
    return NextResponse.json(
      { error: "Set WHATSAPP_TOKEN, WABA_ID and PHONE_NUMBER_ID in .env.local to send." },
      { status: 428 },
    );
  }
  const { template, to, values } = (await request.json()) as {
    template: Template;
    to: string;
    values: Record<string, string>;
  };
  if (!to?.trim()) {
    return NextResponse.json({ error: "Which number should it go to?" }, { status: 400 });
  }
  try {
    return NextResponse.json(await send(account, template, to.replace(/[^\d+]/g, ""), values ?? {}));
  } catch (error) {
    if (error instanceof WabaError) {
      return NextResponse.json({ error: error.message, raw: error.raw }, { status: error.status });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
