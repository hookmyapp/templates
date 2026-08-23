"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Copy,
  Send,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { TONE, keyOf, sendValues, stageOf, validate, type Issue, type Template } from "@/lib/core";
import type { AccountState, Feedback } from "@/lib/store";
import { Preview } from "@/components/preview";
import { Editor } from "@/components/editor";
import { Decoder } from "@/components/decoder";
import { FeedbackButton, FeedbackPanel } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function Workbench({
  initial,
  feedback,
  templates,
  state,
  writable,
  connected,
  canSend,
}: {
  initial: Template;
  feedback: Feedback[];
  templates: string[];
  /** What the account last said about this one, when it has been asked. */
  state?: AccountState;
  writable: boolean;
  connected: boolean;
  canSend: boolean;
}) {
  const [template, setTemplate] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [rejection, setRejection] = useState("");
  const router = useRouter();

  const key = keyOf(template);
  const savedKey = keyOf(saved);
  const result = validate(template);
  const stage = stageOf(result, state?.status);
  const dirty = JSON.stringify(template) !== JSON.stringify(saved);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        body: JSON.stringify({ template, from: savedKey }),
      });
      const answer = await response.json();
      if (!response.ok) throw new Error(answer.error);
      setSaved(template);
      if (answer.key !== savedKey) router.replace(`/t/${answer.key}`);
      else router.refresh();
      toast.success("Saved");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [template, savedKey, router]);

  // Cmd-S is what everyone's hands do in an editor, so it saves here too.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        if (dirty && writable) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, writable, save]);

  // Leaving with unsaved edits loses them, so the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function submit() {
    const response = await fetch("/api/waba/push", {
      method: "POST",
      body: JSON.stringify({ template }),
    });
    const answer = await response.json();
    if (!response.ok) {
      // The whole answer goes into the reader, which is the only place it is
      // any use.
      setRejection(answer.raw ?? answer.error);
      toast.error(answer.error);
      return;
    }
    toast.success(`Submitted for review. Meta calls it ${answer.id}.`);
    router.refresh();
  }

  async function destroy() {
    await fetch(`/api/templates/${savedKey}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft />
          All templates
        </Button>
        <code className="text-sm font-medium">{key}</code>
        <Stage stage={stage} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FeedbackButton feedback={feedback} />
          <Decoder
            template={template}
            initial={rejection || state?.rejected_reason || ""}
            label="Read a rejection"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(JSON.stringify(template, null, 2));
              toast.success("The submit payload is on your clipboard.");
            }}
          >
            <Copy />
            Copy JSON
          </Button>
          {connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={submit}
              disabled={!result.ok || stage.stage === "pending"}
              title={stage.stage === "pending" ? "Already waiting on Meta." : undefined}
            >
              <Upload />
              {stage.stage === "approved" ? "Submit the change" : "File for approval"}
            </Button>
          ) : null}
          {writable ? (
            <>
              <Button size="sm" onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </Button>
              <Button variant="ghost" size="sm" onClick={destroy}>
                <Trash2 />
              </Button>
            </>
          ) : (
            <Badge variant="outline">Read-only</Badge>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_352px]">
        <Editor template={template} issues={result.issues} onChange={setTemplate} />

        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <Preview template={template} chrome />

          <Tabs defaultValue="checks">
            <TabsList className="w-full">
              <TabsTrigger value="checks">
                Checks
                {result.issues.length ? (
                  <Badge variant="outline" className="ml-1.5 text-[10px]">
                    {result.issues.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="send" disabled={!canSend}>
                Send
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checks">
              <Checks result={result} />
            </TabsContent>
            <TabsContent value="send">
              <TestSend template={template} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <FeedbackPanel
        feedback={feedback}
        templates={templates}
        writable={writable}
        current={savedKey}
      />
    </main>
  );
}

function Stage({ stage }: { stage: ReturnType<typeof stageOf> }) {
  return (
    <span className="flex items-center gap-2">
      <Badge variant="outline" className={cn("font-medium", TONE[stage.tone])}>
        {stage.label}
      </Badge>
      <span className="text-muted-foreground hidden text-xs lg:inline">{stage.detail}</span>
    </span>
  );
}

function Checks({ result }: { result: ReturnType<typeof validate> }) {
  if (!result.issues.length) {
    return (
      <p className="text-muted-foreground rounded-lg border p-4 text-sm">
        Nothing to fix and nothing to look at. This one is ready to submit.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {result.issues.map((issue: Issue, index) => (
        <li key={index} className="rounded-lg border p-3 text-xs">
          <div className="flex items-start gap-2">
            {issue.severity === "error" ? (
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
            )}
            <div className="min-w-0">
              <p className="leading-relaxed">{issue.message}</p>
              {issue.fix ? <p className="text-muted-foreground mt-1">{issue.fix}</p> : null}
              <code className="text-muted-foreground/70 mt-1 block truncate text-[10px]">
                {issue.path}
              </code>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Send the template to one number. The preview is a drawing, and a drawing has
 * never been the thing that gets signed off.
 */
function TestSend({ template }: { template: Template }) {
  const [to, setTo] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => sendValues(template));
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const response = await fetch("/api/waba/send", {
        method: "POST",
        body: JSON.stringify({ template, to, values }),
      });
      const answer = await response.json();
      if (!response.ok) throw new Error(answer.error);
      toast.success("Sent. Look at your phone.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        The template has to be approved already. Sending only works to a number that has written to
        you in the last day, or to one on your test list.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="to">Number</Label>
        <Input
          id="to"
          value={to}
          placeholder="+15551234567"
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      {Object.keys(values).map((token) => (
        <div key={token} className="space-y-1.5">
          <Label className="text-xs">{`{{${token}}}`}</Label>
          <Input
            value={values[token]}
            onChange={(event) => setValues({ ...values, [token]: event.target.value })}
          />
        </div>
      ))}
      <Button size="sm" className="w-full" onClick={send} disabled={sending || !to.trim()}>
        <Send />
        {sending ? "Sending…" : "Send it to my phone"}
      </Button>
    </div>
  );
}
