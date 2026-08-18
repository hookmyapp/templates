'use client';

import { useState } from 'react';
import { ChevronDown, MessageSquare, Play, Search, Settings2, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

export type Contact = { contact_wa_id: string; last_at: string; last_body: string };
export type View = 'chat' | 'instructions' | 'playground' | 'settings';

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
  view,
  connected,
  mode,
  query,
  onQuery,
  onSelect,
  onView,
}: {
  contacts: Contact[];
  active: string | null;
  view: View;
  connected: boolean;
  mode: 'sandbox' | 'live';
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onView: (v: View) => void;
}) {
  const [buildOpen, setBuildOpen] = useState(true);

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
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Build" onClick={() => setBuildOpen((o) => !o)}>
                  <Wrench className="size-4" />
                  <span>Build</span>
                  <ChevronDown
                    className={`ml-auto transition-transform ${buildOpen ? '' : '-rotate-90'}`}
                  />
                </SidebarMenuButton>
                {buildOpen ? (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={view === 'instructions'}
                        onClick={() => onView('instructions')}
                      >
                        <span>Instructions</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={view === 'playground'}
                  onClick={() => onView('playground')}
                  tooltip="Playground"
                >
                  <Play className="size-4" />
                  <span>Playground</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <div className="relative px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-4 size-3.5" />
            <Input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search number or text"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <SidebarMenu>
            {contacts.length === 0 ? (
              <p className="text-muted-foreground px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
                {query ? 'Nothing matches that.' : 'No messages yet.'}
              </p>
            ) : (
              contacts.map((c) => (
                <SidebarMenuItem key={c.contact_wa_id}>
                  <SidebarMenuButton
                    isActive={view === 'chat' && active === c.contact_wa_id}
                    onClick={() => onSelect(c.contact_wa_id)}
                    tooltip={c.contact_wa_id}
                    className="h-auto py-2"
                  >
                    <MessageSquare className="size-4 shrink-0 self-start" />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs">{c.contact_wa_id}</span>
                        <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
                          {short(c.last_at)}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {c.last_body || 'No text'}
                      </span>
                    </span>
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
              onClick={() => onView('settings')}
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
