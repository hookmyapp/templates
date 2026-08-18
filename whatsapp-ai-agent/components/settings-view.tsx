'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectCard } from '@/components/connect-card';
import type { Status } from '@/components/status';

export function SettingsView({ status, onChange }: { status: Status; onChange: () => void }) {
  const [keys, setKeys] = useState({ hookmyapp: '', workspace: '', openrouter: '' });
  const [busy, setBusy] = useState(false);

  const save = async (body: Record<string, string>, done: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(done);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>
            Stored in your database. Leave a field blank to keep the current value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="hookmyapp"
            label="HookMyApp API key"
            placeholder={status.keys.hookmyapp ?? 'hmok_...'}
            value={keys.hookmyapp}
            onChange={(v) => setKeys({ ...keys, hookmyapp: v })}
          />
          <Field
            id="workspace"
            label="Workspace id"
            placeholder={status.keys.workspace ?? 'ws_...'}
            value={keys.workspace}
            onChange={(v) => setKeys({ ...keys, workspace: v })}
          />
          <Field
            id="openrouter"
            label="OpenRouter key"
            placeholder={status.keys.openrouter ?? 'sk-or-...'}
            value={keys.openrouter}
            onChange={(v) => setKeys({ ...keys, openrouter: v })}
          />
          <Button
            disabled={busy}
            onClick={() =>
              save(
                {
                  hookmyappApiKey: keys.hookmyapp,
                  hookmyappWorkspaceId: keys.workspace,
                  openrouterApiKey: keys.openrouter,
                },
                'Credentials saved',
              ).then(() => setKeys({ hookmyapp: '', workspace: '', openrouter: '' }))
            }
          >
            Save credentials
          </Button>
        </CardContent>
      </Card>

      <ConnectCard status={status} onChange={onChange} />

    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
