'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectCard } from '@/components/connect-card';
import type { Status } from '@/components/status';

export function SettingsView({ status, onChange }: { status: Status; onChange: () => void }) {
  const [openrouter, setOpenrouter] = useState('');
  const [hookmyapp, setHookmyapp] = useState({ key: '', workspace: '' });
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
          <CardTitle className="flex items-center gap-2">
            OpenRouter
            {status.keys.openrouter ? <Saved /> : null}
          </CardTitle>
          <CardDescription>
            The key the agent answers with. Get one at openrouter.ai/keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="openrouter"
            label="API key"
            stored={status.keys.openrouter}
            hint="sk-or-..."
            value={openrouter}
            onChange={setOpenrouter}
          />
          <Button
            disabled={busy || !openrouter.trim()}
            onClick={() =>
              save({ openrouterApiKey: openrouter }, 'OpenRouter key saved').then(() =>
                setOpenrouter(''),
              )
            }
          >
            Save key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            HookMyApp
            {status.keys.hookmyapp && status.keys.workspace ? <Saved /> : null}
          </CardTitle>
          <CardDescription>
            Used to list your numbers and to point the webhook at this deployment. Leave a field
            blank to keep the current value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="hookmyapp-key"
            label="API key"
            stored={status.keys.hookmyapp}
            hint="hmok_..."
            value={hookmyapp.key}
            onChange={(v) => setHookmyapp({ ...hookmyapp, key: v })}
          />
          <Field
            id="workspace"
            label="Workspace id"
            stored={status.keys.workspace}
            hint="ws_..."
            value={hookmyapp.workspace}
            onChange={(v) => setHookmyapp({ ...hookmyapp, workspace: v })}
          />
          <Button
            disabled={busy || (!hookmyapp.key.trim() && !hookmyapp.workspace.trim())}
            onClick={() =>
              save(
                {
                  hookmyappApiKey: hookmyapp.key,
                  hookmyappWorkspaceId: hookmyapp.workspace,
                },
                'HookMyApp credentials saved',
              ).then(() => setHookmyapp({ key: '', workspace: '' }))
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

function Saved() {
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Check className="size-3" />
      Saved
    </Badge>
  );
}

/** A stored value is shown as text with a Replace button, so it reads as set. */
function Field({
  id,
  label,
  stored,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  stored: string | null;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const showStored = Boolean(stored) && !editing;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {showStored ? (
        <div className="flex items-center gap-2">
          <Input id={id} value={stored ?? ''} readOnly className="font-mono text-sm" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange('');
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
            Replace
          </Button>
        </div>
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={hint}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoFocus={editing}
        />
      )}
    </div>
  );
}
