'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Status } from '@/components/status';

type Channel = { publicId: string; displayName?: string; phoneNumber?: string };
type Sandbox = {
  session: { id: string; phone: string; webhookUrl: string | null } | null;
  bind?: { code: string; phoneNumber?: string };
  pointsHere?: boolean;
};

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function ConnectCard({ status, onChange }: { status: Status; onChange: () => void }) {
  const [tab, setTab] = useState<'sandbox' | 'live'>(status.mode);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (tab === 'live') {
      fetch('/api/channels')
        .then((r) => r.json())
        .then((d) => {
          setChannels(d.channels ?? []);
          setProblem(d.error ?? null);
        })
        .catch((e) => setProblem(String(e)));
    } else {
      const load = () =>
        fetch('/api/sandbox')
          .then((r) => r.json())
          .then((d) => {
            setSandbox(d.error ? null : d);
            setProblem(d.error ?? null);
          })
          .catch((e) => setProblem(String(e)));
      load();
      const t = setInterval(load, 5000);
      return () => clearInterval(t);
    }
  }, [tab]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Opens Meta sign-in, then watches the channel list until a number that was
   * not there before shows up, and points the webhook at this deployment.
   */
  const connect = async () => {
    setConnecting(true);
    try {
      const before = new Set(channels.map((c) => c.publicId));
      const { redirectUrl } = (await post('/api/connect/start')) as { redirectUrl: string };
      window.open(redirectUrl, '_blank');
      toast.info('Finish the sign-in in the new tab. This page picks the number up.');

      const deadline = Date.now() + 15 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const list = (await fetch('/api/channels').then((r) => r.json())) as {
          channels?: Channel[];
        };
        setChannels(list.channels ?? []);
        const fresh = (list.channels ?? []).find((c) => !before.has(c.publicId));
        if (fresh) {
          await post('/api/channels/select', { channelId: fresh.publicId });
          toast.success('Number connected and receiving here');
          onChange();
          return;
        }
      }
      toast.error('Gave up waiting. Pick the number from the list once it appears.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Connection
          {status.connected ? (
            <Badge>{status.mode === 'sandbox' ? 'Sandbox' : 'Live number'}</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Choose where this agent answers. Sandbox needs no Meta account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'sandbox' | 'live')}>
          <TabsList>
            <TabsTrigger value="sandbox">Sandbox number</TabsTrigger>
            <TabsTrigger value="live">Real number</TabsTrigger>
          </TabsList>

          <TabsContent value="sandbox" className="space-y-3 pt-4">
            {sandbox?.session ? (
              <>
                <p className="text-sm">
                  Session bound to <span className="font-mono">{sandbox.session.phone}</span>.
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => run(() => post('/api/sandbox/select'), 'Sandbox points here')}
                  >
                    Receive messages here
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => run(() => post('/api/sandbox/release'), 'Sandbox released')}
                  >
                    Release
                  </Button>
                </div>
              </>
            ) : sandbox?.bind ? (
              <div className="space-y-2 text-sm">
                <p>Send this code from WhatsApp to the sandbox number, then wait a moment.</p>
                <p className="font-mono text-2xl">{sandbox.bind.code}</p>
                {sandbox.bind.phoneNumber ? (
                  <p className="text-muted-foreground">to {sandbox.bind.phoneNumber}</p>
                ) : null}
              </div>
            ) : problem ? (
              <p className="text-destructive text-sm">{problem}</p>
            ) : (
              <p className="text-muted-foreground text-sm">Loading sandbox status.</p>
            )}
          </TabsContent>

          <TabsContent value="live" className="space-y-3 pt-4">
            {channels.length ? (
              <ul className="space-y-2">
                {channels.map((c) => (
                  <li key={c.publicId} className="flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {c.displayName ?? c.phoneNumber ?? c.publicId}
                      {status.channelId === c.publicId ? (
                        <Badge className="ml-2" variant="secondary">
                          in use
                        </Badge>
                      ) : null}
                    </span>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => post('/api/channels/select', { channelId: c.publicId }),
                          'Webhook set on this number',
                        )
                      }
                    >
                      Use this number
                    </Button>
                  </li>
                ))}
              </ul>
            ) : problem ? (
              <p className="text-destructive text-sm">{problem}</p>
            ) : (
              <p className="text-muted-foreground text-sm">No WhatsApp numbers connected yet.</p>
            )}
            <Button variant="outline" disabled={busy || connecting} onClick={connect}>
              {connecting ? 'Waiting for the sign-in to finish' : 'Connect a new number'}
            </Button>
          </TabsContent>
        </Tabs>

        {status.webhookUrl ? (
          <p className="text-xs text-muted-foreground break-all">
            Webhook URL: <span className="font-mono">{status.webhookUrl}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
