'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppSidebar, type Contact } from '@/components/app-sidebar';
import { ChatView } from '@/components/chat-view';
import { SettingsView } from '@/components/settings-view';
import type { Status } from '@/components/status';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'settings'>('chat');

  const loadStatus = useCallback(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(loadStatus, [loadStatus]);

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

  return (
    <SidebarProvider>
      <AppSidebar
        contacts={contacts}
        active={active}
        view={view}
        connected={status?.connected ?? false}
        mode={status?.mode ?? 'sandbox'}
        onSelect={(id) => {
          setActive(id);
          setView('chat');
        }}
        onSettings={() => setView('settings')}
      />
      <SidebarInset className="flex h-svh flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <h1 className="text-sm font-medium">
            {view === 'settings' ? 'Settings' : (active ?? 'Conversations')}
          </h1>
          {view === 'chat' && status ? (
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
          ) : (
            <ChatView contact={active} />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
