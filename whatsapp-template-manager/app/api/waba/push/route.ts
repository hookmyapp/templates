import { NextResponse } from "next/server";
import { connection, push, WabaError } from "@/lib/waba";
import { keyOf } from "@/lib/core";
import { setAccountState } from "@/lib/store";
import type { Template } from "@/lib/core";

/** Submit a template for review, or update one that already exists. */
export async function POST(request: Request) {
  const account = connection();
  if (!account) {
    return NextResponse.json(
      { error: "Set WHATSAPP_TOKEN and WABA_ID in .env.local to submit." },
      { status: 428 },
    );
  }
  const { template, id } = (await request.json()) as { template: Template; id?: string };
  try {
    const answer = await push(account, template, id);
    // Anything Meta accepts goes into review, so the list stops calling it
    // "ready to submit" the moment it has been.
    await setAccountState(keyOf(template), {
      status: (answer.status as never) ?? "PENDING",
      id: answer.id,
    });
    return NextResponse.json(answer);
  } catch (error) {
    if (error instanceof WabaError) {
      // The raw answer comes back too, because the rejection reader reads it.
      return NextResponse.json({ error: error.message, raw: error.raw }, { status: error.status });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
