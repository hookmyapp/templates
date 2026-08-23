import { Gallery } from "@/components/gallery";
import { feedback, list, writable } from "@/lib/store";
import { connection } from "@/lib/waba";

// The templates are files on disk, and a file can change while the app is up.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [templates, canWrite, notes] = await Promise.all([list(), writable(), feedback()]);
  return (
    <Gallery
      templates={templates}
      feedback={notes}
      writable={canWrite}
      connected={Boolean(connection())}
    />
  );
}
