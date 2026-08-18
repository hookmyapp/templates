'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function PromptCard({
  initialPrompt,
  initialModel,
}: {
  initialPrompt: string;
  initialModel: string;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [model, setModel] = useState(initialModel);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: prompt, model }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Saved. The next message uses it.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt</CardTitle>
        <CardDescription>What the agent is and how it should answer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">System prompt</Label>
          <Textarea
            id="prompt"
            rows={10}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Any model id from openrouter.ai/models.
          </p>
        </div>
        <Button onClick={save} disabled={busy}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
