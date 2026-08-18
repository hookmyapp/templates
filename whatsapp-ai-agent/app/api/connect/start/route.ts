import { startConnect } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

/** Hands back the Meta sign-in URL. The number lands in your own workspace. */
export async function POST() {
  try {
    return Response.json(await startConnect());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
