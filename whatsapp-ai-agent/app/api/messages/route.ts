import { contacts, history } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const contact = params.get('contact');
  if (contact) return Response.json({ messages: await history(contact, 100) });
  return Response.json({ contacts: await contacts(params.get('q') ?? '') });
}
