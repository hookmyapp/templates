import { NextResponse } from "next/server";
import { connection, pull, WabaError } from "@/lib/waba";

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
    return NextResponse.json({ templates: await pull(account) });
  } catch (error) {
    if (error instanceof WabaError) {
      return NextResponse.json({ error: error.message, raw: error.raw }, { status: error.status });
    }
    throw error;
  }
}
