import { contacts, history } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const contact = new URL(req.url).searchParams.get('contact');
  if (contact) return Response.json({ messages: await history(contact, 100) });
  return Response.json({ contacts: await contacts() });
}
