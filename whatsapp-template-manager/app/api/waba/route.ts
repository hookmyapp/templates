import { NextResponse } from "next/server";
import { connection, pull, WabaError } from "@/lib/waba";
import { keyOf } from "@/lib/core";
import { setAccountState } from "@/lib/store";

/** Every template on the account, as the account has it. */
export async function GET() {
  const account = connection();
  if (!account) {
    return NextResponse.json(
      { error: "Set WHATSAPP_TOKEN and WABA_ID in .env.local to read the account." },
      { status: 428 },
    );
  }
  try {
    const templates = await pull(account);
    // The account is the authority on what is approved, so its answer is
    // written down as soon as it is heard.
    for (const template of templates) {
      await setAccountState(keyOf(template), {
        status: template.status,
        id: template.id,
        rejected_reason: template.rejected_reason,
      });
    }
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof WabaError) {
      return NextResponse.json({ error: error.message, raw: error.raw }, { status: error.status });
    }
    throw error;
  }
}
