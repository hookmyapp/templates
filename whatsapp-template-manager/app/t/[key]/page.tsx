import { notFound } from "next/navigation";
import { Workbench } from "@/components/workbench";
import { feedback, list, read, writable } from "@/lib/store";
import { keyOf } from "@/lib/core";
import { connection } from "@/lib/waba";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const template = await read(key);
  if (!template) notFound();

  const [notes, canWrite, all] = await Promise.all([feedback(), writable(), list()]);
  const account = connection();

  return (
    <Workbench
      initial={template}
      feedback={notes}
      templates={all.map(keyOf)}
      writable={canWrite}
      connected={Boolean(account)}
      canSend={Boolean(account?.phoneNumberId)}
    />
  );
}
