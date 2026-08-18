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
      pointsHere: session.webhookUrl === webhookUrl(),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
