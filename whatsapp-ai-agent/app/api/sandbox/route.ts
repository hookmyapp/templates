import { errors, publicError, reportError } from '@/lib/errors';
import { activeSandboxSession, bindCode, webhookUrl } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await activeSandboxSession();
    if (!session) return Response.json({ session: null, bind: await bindCode() });
    return Response.json({
      session: {
        id: session.id,
        phone: session.whatsappPhone,
        webhookUrl: session.webhookUrl ?? null,
      },
      pointsHere: session.webhookUrl === (await webhookUrl()),
    });
  } catch (err) {
    reportError('sandbox', err);
    return Response.json({ error: publicError(err, errors.connect) }, { status: 502 });
  }
}
