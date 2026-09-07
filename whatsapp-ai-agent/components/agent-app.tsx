'use client';

import { errors, publicError } from '@/lib/errors';
import { requestJson } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppSidebar, type Contact, type View } from '@/components/app-sidebar';
import { ChatView } from '@/components/chat-view';
import { InstructionsView } from '@/components/instructions-view';
import { PlaygroundView } from '@/components/playground-view';
import { SettingsView } from '@/components/settings-view';
import type { Status } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

const TITLES: Record<Exclude<View, 'chat'>, string> = {
  instructions: 'Instructions',
  playground: 'Playground',
  settings: 'Settings',
};

export function AgentApp({ view, active = null }: { view: View; active?: string | null }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');

  const loadStatus = useCallback(() => {
    requestJson('/api/settings')
      .then((value) => { setStatus(value); setProblem(null); })
      .catch((error) => setProblem(publicError(error, errors.load)));
  }, []);

  useEffect(loadStatus, [loadStatus]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('openrouter');
    if (!result) return;
    if (result === 'connected') toast.success('OpenRouter connected');
    else toast.error('Could not connect OpenRouter. Try again or enter your key in Settings.');
    url.searchParams.delete('openrouter');
    window.history.replaceState(null, '', url);
  }, []);

  useEffect(() => {
    const load = () =>
      requestJson(`/api/messages?q=${encodeURIComponent(query)}`)
        .then((d) => {
          setContacts(d.contacts ?? []);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [query]);

  return (
    <SidebarProvider>
      <AppSidebar
        contacts={contacts}
        active={active}
        view={view}
        connected={status?.connected ?? false}
        mode={status?.mode ?? 'sandbox'}
        query={query}
        onQuery={setQuery}
      />
      <SidebarInset className="flex h-svh flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <h1 className="text-sm font-medium">
            {view === 'chat' ? (active ?? 'Conversations') : TITLES[view]}
          </h1>
          {status ? (
            <Badge variant={status.connected ? 'default' : 'outline'} className="ml-auto">
              {status.connected
                ? status.mode === 'sandbox'
                  ? 'Sandbox'
                  : 'Live number'
                : 'Not connected'}
            </Badge>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {problem ? (
            <div role="alert" className="space-y-3 p-6">
              <p>{problem}</p>
              <Button onClick={loadStatus}>Try Again</Button>
            </div>
          ) : !status ? (
            <div className="mx-auto max-w-2xl space-y-4 p-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : view === 'settings' ? (
            <SettingsView status={status} onChange={loadStatus} />
          ) : view === 'instructions' ? (
            <InstructionsView
              key={status.systemPrompt + status.model + status.temperature}
              status={status}
              onChange={loadStatus}
              onSettings={() => router.push('/settings')}
            />
          ) : view === 'playground' ? (
            <PlaygroundView />
          ) : (
            <ChatView contact={active} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
