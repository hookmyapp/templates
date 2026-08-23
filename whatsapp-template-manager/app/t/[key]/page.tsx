import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench";
import { comments, read, writable } from "@/lib/store";
import { connection } from "@/lib/waba";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const template = await read(key);
  if (!template) notFound();

  const [notes, canWrite] = await Promise.all([comments(), writable()]);
  const account = connection();

  return (
    <Workbench
      initial={template}
      notes={notes}
      writable={canWrite}
      connected={Boolean(account)}
      canSend={Boolean(account?.phoneNumberId)}
    />
  );
}
