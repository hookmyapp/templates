'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Turn = { direction: 'in' | 'out'; body: string; error?: boolean };

export function PlaygroundView() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, busy]);

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    const history = turns.filter((t) => !t.error);
    setTurns([...turns, { direction: 'in', body: message }]);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, message }),
      });
      const data = await res.json();
      setTurns((t) => [
        ...t,
        res.ok
          ? { direction: 'out', body: data.reply }
          : { direction: 'out', body: data.error ?? 'Request failed', error: true },
      ]);
    } catch (err) {
      setTurns((t) => [...t, { direction: 'out', body: String(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {turns.length === 0 ? (
          <p className="text-muted-foreground pt-10 text-center text-sm">
            Try the prompt here. Nothing is sent to WhatsApp and nothing is saved.
          </p>
        ) : (
          <div className="space-y-3">
            {turns.map((t, i) => (
              <div
                key={i}
                className={cn('flex', t.direction === 'in' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                    t.direction === 'in'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : t.error
                        ? 'bg-destructive/10 text-destructive rounded-bl-sm'
                        : 'bg-muted rounded-bl-sm',
                  )}
                >
                  {t.body}
                </div>
              </div>
            ))}
            {busy ? <p className="text-muted-foreground text-sm">Thinking...</p> : null}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t p-4">
        <Input
          value={draft}
          placeholder="Send a message the way a customer would"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <Button onClick={send} disabled={busy || !draft.trim()} size="icon">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
