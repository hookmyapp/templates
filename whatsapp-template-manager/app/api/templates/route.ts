import { NextResponse } from "next/server";
import { list, remove, write, writable } from "@/lib/store";
import { validate, type Template } from "@/lib/core";

export async function GET() {
  return NextResponse.json({ templates: await list(), writable: await writable() });
}

export async function POST(request: Request) {
  if (!(await writable())) {
    return NextResponse.json(
      { error: "This copy is running on a read-only disk, so it cannot save. Run it locally to edit." },
      { status: 409 },
    );
  }
  // Two shapes are accepted: a bare template, and `{ template, from }` when the
  // editor is renaming one. A request body can only be read once, so the shape
  // is worked out after parsing rather than before.
  const payload = (await request.json()) as { template?: Template; from?: string } | Template;
  const subject = ("template" in payload ? payload.template : payload) as Template | undefined;
  const from = "template" in payload ? payload.from : undefined;
  if (!subject?.name?.trim()) {
    return NextResponse.json({ error: "A template needs a name before it can be saved." }, { status: 400 });
  }
  // Saving a draft that does not pass yet is allowed on purpose, because the
  // whole point is to work on it. The result rides along so the editor knows.
  const key = await write(subject);
  // A rename is a new file, so the old one goes rather than lingering as a
  // duplicate nobody edits.
  if (from && from !== key) await remove(from);
  return NextResponse.json({ key, result: validate(subject) });
}
