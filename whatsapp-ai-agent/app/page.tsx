'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<View>('instructions');
  const [query, setQuery] = useState('');

  const loadStatus = useCallback(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(loadStatus, [loadStatus]);

  useEffect(() => {
    const load = () =>
      fetch(`/api/messages?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => {
          setContacts(d.contacts ?? []);
          setActive((cur) => cur ?? d.contacts?.[0]?.contact_wa_id ?? null);
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
        onSelect={(id) => {
          setActive(id);
          setView('chat');
        }}
        onView={setView}
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
          {!status ? (
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
              onSettings={() => setView('settings')}
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
