import { errors, publicError, reportError } from '@/lib/errors';
import { contacts, history } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const contact = params.get('contact');
    if (contact) return Response.json({ messages: (await history(contact, 100)).map((message) => ({
      ...message, error: message.error ? publicError(message.error, errors.reply) : null,
    })) });
    return Response.json({ contacts: await contacts(params.get('q') ?? '') });
  } catch (err) {
    reportError('messages', err);
    return Response.json({ error: publicError(err, errors.load) }, { status: 502 });
  }
}
