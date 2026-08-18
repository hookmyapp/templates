import { listChannels } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ channels: await listChannels() });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
