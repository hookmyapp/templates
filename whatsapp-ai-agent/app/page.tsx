'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatCard } from '@/components/chat-card';
import { ConnectCard } from '@/components/connect-card';
import { PromptCard } from '@/components/prompt-card';

type Status = {
  systemPrompt: string;
  model: string;
  mode: 'sandbox' | 'live';
  connected: boolean;
  channelId: string | null;
  sandboxSessionId: string | null;
  phoneNumberId: string | null;
  webhookUrl: string | null;
};

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const load = useCallback(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">WhatsApp AI agent</h1>
        <p className="text-muted-foreground text-sm">
          Connect a number, write the prompt, read the conversations.
        </p>
      </header>

      {status ? (
        <>
          <ConnectCard status={status} onChange={load} />
          <PromptCard
            key={status.systemPrompt + status.model}
            initialPrompt={status.systemPrompt}
            initialModel={status.model}
          />
          <ChatCard />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Loading. If this does not go away, check that DATABASE_URL is set.
        </p>
      )}
    </main>
  );
}
