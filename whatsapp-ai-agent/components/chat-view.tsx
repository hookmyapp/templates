'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Msg = {
  id: string;
  direction: 'in' | 'out';
  body: string;
  error: string | null;
  created_at: string;
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function ChatView({ contact }: { contact: string | null }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contact) return;
    const load = () =>
      fetch(`/api/messages?contact=${encodeURIComponent(contact)}`)
        .then((r) => r.json())
        .then((d) => setMessages(d.messages ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [contact]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (!contact) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
        <MessageSquare className="size-8" />
        <p className="text-sm">
          No conversation yet. Message the connected number and it appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end">
      <div className="space-y-3 px-4 py-6">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn('flex flex-col gap-1', m.direction === 'in' ? 'items-start' : 'items-end')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                m.direction === 'in'
                  ? 'bg-muted rounded-bl-sm'
                  : m.error
                    ? 'bg-destructive/10 text-destructive rounded-br-sm'
                    : 'bg-primary text-primary-foreground rounded-br-sm',
              )}
            >
              {m.error ? `Could not answer: ${m.error}` : m.body}
            </div>
            <span className="text-muted-foreground px-1 text-[11px]">{time(m.created_at)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>
    </div>
  );
}
