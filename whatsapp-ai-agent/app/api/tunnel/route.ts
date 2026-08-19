import { getSettings } from '@/lib/db';
import { selfUrl } from '@/lib/hookmyapp';
import { start, status, stop } from '@/lib/tunnel';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(status());
}

/** Runs the agent on this computer by tunnelling messages to the dev server. */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { error: 'A deployment already receives messages directly.' },
      { status: 409 },
    );
  }

  const settings = await getSettings();
  if (!settings.hmac_secret) {
    return Response.json({ error: 'Connect a number first.' }, { status: 409 });
  }

  const port = Number(new URL(await selfUrl()).port || 3000);
  return Response.json(
    start({
      port,
      channelId: settings.mode === 'live' ? (settings.channel_id ?? undefined) : undefined,
      target: settings.mode === 'live' ? 'your number' : 'the sandbox number',
    }),
  );
}

export async function DELETE() {
  stop();
  return Response.json(status());
}
