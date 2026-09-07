import { errors, publicError, reportError } from '@/lib/errors';
import { status, stop } from '@/lib/tunnel';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(status());
}

export async function DELETE() {
  try {
    await stop();
    return Response.json(status());
  } catch (err) {
    reportError('tunnel', err);
    return Response.json({ error: publicError(err, errors.connect) }, { status: 502 });
  }
}
