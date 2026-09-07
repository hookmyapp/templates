import { errors, publicError, reportError } from '@/lib/errors';
import { startConnect } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

/** Hands back the Meta sign-in URL. The number lands in your own workspace. */
export async function POST() {
  try {
    return Response.json(await startConnect());
  } catch (err) {
    reportError('connect', err);
    return Response.json({ error: publicError(err, errors.connect) }, { status: 502 });
  }
}
