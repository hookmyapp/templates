import { errors, publicError, reportError } from '@/lib/errors';
import { listChannels } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ channels: await listChannels() });
  } catch (err) {
    reportError('channels', err);
    return Response.json({ error: publicError(err, errors.connect) }, { status: 502 });
  }
}
