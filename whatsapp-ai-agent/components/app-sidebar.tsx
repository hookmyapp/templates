'use client';

import { MessageSquare, Settings2 } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';

export type Contact = { contact_wa_id: string; last_at: string };

const short = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
};

export function AppSidebar({
  contacts,
  active,
  onSelect,
  onSettings,
  view,
  connected,
  mode,
}: {
  contacts: Contact[];
  active: string | null;
  onSelect: (id: string) => void;
  onSettings: () => void;
  view: 'chat' | 'settings';
  connected: boolean;
  mode: 'sandbox' | 'live';
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2 px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <MessageSquare className="size-4" />
          </div>
          <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">WhatsApp agent</span>
            <span className="text-muted-foreground truncate text-xs">
              {connected ? (mode === 'sandbox' ? 'Sandbox' : 'Live number') : 'Not connected'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarMenu>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
                No messages yet.
              </p>
            ) : (
              contacts.map((c) => (
                <SidebarMenuItem key={c.contact_wa_id}>
                  <SidebarMenuButton
                    isActive={view === 'chat' && active === c.contact_wa_id}
                    onClick={() => onSelect(c.contact_wa_id)}
                    tooltip={c.contact_wa_id}
                  >
                    <MessageSquare className="size-4" />
                    <span className="font-mono text-xs">{c.contact_wa_id}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {short(c.last_at)}
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={view === 'settings'}
              onClick={onSettings}
              tooltip="Settings"
            >
              <Settings2 className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
