import { NextResponse } from "next/server";
import { deleteComment, updateComment, writable } from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await writable())) {
    return NextResponse.json({ error: "This copy cannot write to disk." }, { status: 409 });
  }
  const { id } = await params;
  const updated = await updateComment(id, await request.json());
  if (!updated) return NextResponse.json({ error: `No note called ${id}.` }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await writable())) {
    return NextResponse.json({ error: "This copy cannot write to disk." }, { status: 409 });
  }
  const { id } = await params;
  await deleteComment(id);
  return NextResponse.json({ ok: true });
}
