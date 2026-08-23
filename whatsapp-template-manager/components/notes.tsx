"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Quote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Comment } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/**
 * Notes for whoever picks the template up next, which is usually an agent.
 *
 * They are written to `comments.json`, which is a file in the repository, so
 * Claude or Codex reads them the way it reads any other file, changes the
 * template, and writes back what it did. The protocol is in AGENTS.md.
 *
 * Select any text on the page before writing a note and the selection is
 * quoted into it, so "this line is too formal" says which line.
 */
export function Notes({
  templateKey,
  notes,
  writable,
}: {
  templateKey: string;
  notes: Comment[];
  writable: boolean;
}) {
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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

  const mine = notes.filter((note) => note.template === templateKey);
  const open = mine.filter((note) => note.status === "open");
  const done = mine.filter((note) => note.status === "done");

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({ template: templateKey, body, quote: quote || undefined }),
      });
      const answer = await response.json();
      if (!response.ok) throw new Error(answer.error);
      setBody("");
      setQuote("");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, fields: Partial<Comment>) {
    await fetch(`/api/comments/${id}`, { method: "PATCH", body: JSON.stringify(fields) });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {writable ? (
        <div className="space-y-2 rounded-lg border p-3">
          {quote ? (
            <p className="text-muted-foreground flex gap-1.5 text-xs italic">
              <Quote className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-2">{quote}</span>
              <button className="ml-auto shrink-0 not-italic" onClick={() => setQuote("")}>
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
            Leave a note
          </Button>
        </div>
      ) : null}

      {open.map((note) => (
        <div key={note.id} className="rounded-lg border p-3">
          {note.quote ? (
            <p className="text-muted-foreground mb-1.5 border-l-2 pl-2 text-xs italic">
              {note.quote}
            </p>
          ) : null}
          <p className="text-sm leading-relaxed">{note.body}</p>
          <div className="mt-2 flex items-center gap-1">
            <code className="text-muted-foreground/70 mr-auto text-[10px]">{note.id}</code>
            {writable ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => patch(note.id, { status: "done" })}>
                  <Check />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(note.id)}>
                  <Trash2 />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ))}

      {open.length === 0 && !writable ? (
        <p className="text-muted-foreground text-xs">No notes on this one.</p>
      ) : null}

      {done.length ? (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-xs font-medium">
            {done.length} done
          </summary>
          <div className="mt-2 space-y-2">
            {done.map((note) => (
              <div key={note.id} className="text-xs">
                <p className="text-muted-foreground line-through">{note.body}</p>
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

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Notes live in <code>comments.json</code>. Tell your agent to read it, or{" "}
        <Badge variant="outline" className="font-mono text-[10px]">
          npm run check
        </Badge>{" "}
        lists the open ones.
      </p>
    </div>
  );
}
