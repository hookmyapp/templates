import { NextResponse } from "next/server";
import { addComment, comments, writable } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ comments: await comments() });
}

export async function POST(request: Request) {
  if (!(await writable())) {
    return NextResponse.json(
      { error: "Notes are written to comments.json, and this copy cannot write to disk." },
      { status: 409 },
    );
  }
  const body = (await request.json()) as { template: string; body: string; path?: string; quote?: string };
  if (!body?.template || !body?.body?.trim()) {
    return NextResponse.json({ error: "A note needs a template and something to say." }, { status: 400 });
  }
  return NextResponse.json(await addComment(body));
}
