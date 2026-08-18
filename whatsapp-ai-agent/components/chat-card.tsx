'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Contact = { contact_wa_id: string; last_at: string };
type Msg = {
  id: number;
  direction: 'in' | 'out';
  body: string;
  error: string | null;
  created_at: string;
};

export function ChatCard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    const load = () =>
      fetch('/api/messages')
        .then((r) => r.json())
        .then((d) => {
          setContacts(d.contacts ?? []);
          setActive((cur) => cur ?? d.contacts?.[0]?.contact_wa_id ?? null);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active) return;
    const load = () =>
      fetch(`/api/messages?contact=${encodeURIComponent(active)}`)
        .then((r) => r.json())
        .then((d) => setMessages(d.messages ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [active]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <CardDescription>What the agent received and what it sent back.</CardDescription>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Send a WhatsApp message to the connected number.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <ScrollArea className="h-[420px] rounded-md border">
              <ul className="p-2">
                {contacts.map((c) => (
                  <li key={c.contact_wa_id}>
                    <button
                      onClick={() => setActive(c.contact_wa_id)}
                      className={cn(
                        'w-full rounded px-2 py-1 text-left font-mono text-sm',
                        active === c.contact_wa_id ? 'bg-accent' : 'hover:bg-muted',
                      )}
                    >
                      {c.contact_wa_id}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <ScrollArea className="h-[420px] rounded-md border p-3">
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                      m.direction === 'in'
                        ? 'bg-muted'
                        : m.error
                          ? 'ml-auto bg-destructive/10 text-destructive'
                          : 'ml-auto bg-primary text-primary-foreground',
                    )}
                  >
                    {m.error ? `Failed: ${m.error}` : m.body}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
