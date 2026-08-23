"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check, MessageSquare, Quote, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Feedback } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Feedback on a template, and the panel it lives in.
 *
 * Notes are written to `feedback.json`, which is a file in the repository, so
 * Claude or Codex reads them the way it reads any other file, changes the
 * template, and writes back what it did. The protocol is in AGENTS.md.
 *
 * The panel is opened by an event rather than by prop-drilling an open state
 * through every page: a card three components deep can say "open on this
 * template" without anything in between knowing the panel exists.
 */

const OPEN_EVENT = "feedback:open";

/** Open the panel, optionally aimed at one template. */
export function openFeedback(template?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { template } }));
}

/** The trigger, for a page header. */
export function FeedbackButton({ feedback }: { feedback: Feedback[] }) {
  const open = feedback.filter((note) => note.status === "open").length;
  return (
    <Button variant="outline" onClick={() => openFeedback()}>
      <MessageSquare />
      Feedback
      {open ? (
        <Badge variant="secondary" className="ml-0.5 px-1.5 tabular-nums">
          {open}
        </Badge>
      ) : null}
    </Button>
  );
}

export function FeedbackPanel({
  feedback,
  templates,
  writable,
  current,
}: {
  feedback: Feedback[];
  /** Template keys that can be written about. */
  templates: string[];
  writable: boolean;
  /** The template the page is already about, used as the default subject. */
  current?: string;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(current ?? templates[0] ?? "");
  const router = useRouter();

  useEffect(() => {
    const onOpen = (event: Event) => {
      const asked = (event as CustomEvent<{ template?: string }>).detail?.template;
      if (asked) setSubject(asked);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);

  const groups = useMemo(() => {
    const openNotes = feedback.filter((note) => note.status === "open");
    const done = feedback.filter((note) => note.status === "done");
    return { openNotes, done };
  }, [feedback]);

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <aside
        aria-label="Feedback"
        className={cn(
          "bg-background fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[380px] flex-col border-l shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Feedback</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {groups.openNotes.length} open
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-1.5 ml-auto"
            onClick={() => setOpen(false)}
            aria-label="Close feedback"
          >
            <X />
          </Button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {writable ? (
            <Composer
              templates={templates}
              subject={subject}
              onSubject={setSubject}
              onAdded={refresh}
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              This copy is read-only, so feedback cannot be written here.
            </p>
          )}

          {groups.openNotes.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Nothing open. Select any text on the page before writing, and the selection is quoted
              into the note so it says which line you meant.
            </p>
          ) : (
            groups.openNotes.map((note) => (
              <Card key={note.id} note={note} writable={writable} onChanged={refresh} />
            ))
          )}

          {groups.done.length ? (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-xs font-medium">
                {groups.done.length} done
              </summary>
              <div className="mt-2 space-y-3">
                {groups.done.map((note) => (
                  <div key={note.id} className="text-xs">
                    <Subject note={note} />
                    <p className="text-muted-foreground mt-1 line-through">{note.body}</p>
                    {note.answered ? (
                      <p className="mt-1 flex gap-1.5">
                        <Bot className="mt-0.5 size-3 shrink-0" />
                        <span>{note.answered.note}</span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <footer className="text-muted-foreground border-t px-4 py-2.5 text-[11px] leading-relaxed">
          Written to <code>feedback.json</code>. Point your agent at it, or read{" "}
          <code>AGENTS.md</code> for what it should do with them.
        </footer>
      </aside>
    </>
  );
}

function Composer({
  templates,
  subject,
  onSubject,
  onAdded,
}: {
  templates: string[];
  subject: string;
  onSubject: (next: string) => void;
  onAdded: () => void;
}) {
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);

  // Whatever is highlighted when you reach for the box is what the note is
  // about, so it is captured before the click clears the selection.
  useEffect(() => {
    const capture = () => {
      const selected = window.getSelection()?.toString().trim() ?? "";
      if (selected.length > 1 && selected.length < 400) setQuote(selected);
    };
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, []);

  async function add() {
    if (!body.trim() || !subject) return;
    setBusy(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ template: subject, body, quote: quote || undefined }),
      });
      const answer = await response.json();
      if (!response.ok) throw new Error(answer.error);
      setBody("");
      setQuote("");
      onAdded();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Select value={subject} onValueChange={(value) => onSubject(value as string)}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Which template?" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {templates.map((key) => (
            <SelectItem key={key} value={key}>
              {key}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {quote ? (
        <p className="text-muted-foreground flex gap-1.5 text-xs italic">
          <Quote className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">{quote}</span>
          <button className="ml-auto shrink-0 not-italic underline" onClick={() => setQuote("")}>
            clear
          </button>
        </p>
      ) : null}

      <Textarea
        rows={3}
        value={body}
        placeholder="What should change? The agent reads this."
        onChange={(event) => setBody(event.target.value)}
      />
      <Button size="sm" className="w-full" onClick={add} disabled={busy || !body.trim()}>
        Leave feedback
      </Button>
    </div>
  );
}

function Subject({ note }: { note: Feedback }) {
  return (
    <Link
      href={`/t/${note.template}`}
      className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
    >
      {note.template}
    </Link>
  );
}

function Card({
  note,
  writable,
  onChanged,
}: {
  note: Feedback;
  writable: boolean;
  onChanged: () => void;
}) {
  async function patch(fields: Partial<Feedback>) {
    await fetch(`/api/feedback/${note.id}`, { method: "PATCH", body: JSON.stringify(fields) });
    onChanged();
  }

  async function remove() {
    await fetch(`/api/feedback/${note.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="rounded-lg border p-3">
      <Subject note={note} />
      {note.quote ? (
        <p className="text-muted-foreground mt-1.5 border-l-2 pl-2 text-xs italic">{note.quote}</p>
      ) : null}
      <p className="mt-1.5 text-sm leading-relaxed">{note.body}</p>
      {writable ? (
        <div className="mt-2 flex items-center gap-1">
          <code className="text-muted-foreground/70 mr-auto text-[10px]">{note.id}</code>
          <Button size="sm" variant="ghost" onClick={() => patch({ status: "done" })}>
            <Check />
          </Button>
          <Button size="sm" variant="ghost" onClick={remove}>
            <Trash2 />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
