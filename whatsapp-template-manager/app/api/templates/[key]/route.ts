import { NextResponse } from "next/server";
import { read, remove, writable } from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const template = await read(key);
  if (!template) return NextResponse.json({ error: `No template called ${key}.` }, { status: 404 });
  return NextResponse.json(template);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await writable())) {
    return NextResponse.json({ error: "This copy cannot write to disk." }, { status: 409 });
  }
  const { key } = await params;
  await remove(key);
  return NextResponse.json({ ok: true });
}
