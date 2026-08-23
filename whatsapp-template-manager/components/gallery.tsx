"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  STARTERS,
  TONE,
  keyOf,
  stageOf,
  toPlain,
  validate,
  type Stage,
  type Template,
} from "@/lib/core";
import type { AccountState, Feedback } from "@/lib/store";
import { Preview } from "@/components/preview";
import { Decoder } from "@/components/decoder";
import { FeedbackButton, FeedbackPanel, openFeedback } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The filters, in the order a template moves through them. "Rejected" also
 * covers paused and disabled, because all three mean the same thing to whoever
 * is looking: Meta has a problem with this one.
 */
const FILTERS: Array<{ id: string; label: string; match: (stage: Stage) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  { id: "problems", label: "Needs work", match: (stage) => stage === "needs-work" },
  { id: "ready", label: "Ready", match: (stage) => stage === "ready" },
  {
    id: "pending",
    label: "In review",
    match: (stage) => stage === "pending" || stage === "appealing",
  },
  { id: "approved", label: "Approved", match: (stage) => stage === "approved" },
  {
    id: "rejected",
    label: "Rejected",
    match: (stage) => stage === "rejected" || stage === "paused" || stage === "disabled",
  },
];

function asFilter(value: string | null): string {
  return FILTERS.some((entry) => entry.id === value) ? (value as string) : "all";
}

export function Gallery({
  templates,
  feedback,
  account,
  writable,
  connected,
}: {
  templates: Template[];
  feedback: Feedback[];
  /** What the WhatsApp Business account last said, keyed by template. */
  account: Record<string, AccountState>;
  writable: boolean;
  connected: boolean;
}) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [filter, setFilter] = useState(() => asFilter(params.get("show")));
  const [onlyFeedback, setOnlyFeedback] = useState(() => params.get("feedback") === "1");
  const [pulling, setPulling] = useState(false);
  const router = useRouter();

  // The search and the filters live in the URL, so a refresh keeps them and
  // the view can be sent to someone. This writes the address directly rather
  // than routing: the filtering is done here in the browser, and asking the
  // router for a new URL would fetch the page again on every keystroke.
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (filter !== "all") next.set("show", filter);
    if (onlyFeedback) next.set("feedback", "1");
    const search = next.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [query, filter, onlyFeedback]);

  const rows = useMemo(
    () =>
      templates.map((template) => {
        const key = keyOf(template);
        const result = validate(template);
        const body = template.components.find((component) => component.type === "BODY");
        return {
          key,
          template,
          stage: stageOf(result, account[key]?.status),
          open: feedback.filter((note) => note.template === key && note.status === "open").length,
          haystack: [key, template.category, body && "text" in body ? body.text : ""]
            .join(" ")
            .toLowerCase(),
        };
      }),
    [templates, feedback, account],
  );

  const match = FILTERS.find((entry) => entry.id === filter)?.match ?? (() => true);
  const shown = rows.filter((row) => {
    if (query && !row.haystack.includes(query.toLowerCase())) return false;
    if (onlyFeedback && row.open === 0) return false;
    return match(row.stage.stage);
  });

  async function pull() {
    setPulling(true);
    try {
      const response = await fetch("/api/waba");
      const answer = await response.json();
      if (!response.ok) throw new Error(answer.error);
      const saved = await Promise.all(
        (answer.templates as Template[]).map((template) =>
          fetch("/api/templates", { method: "POST", body: JSON.stringify(template) }),
        ),
      );
      toast.success(`Read ${saved.length} templates off the account.`);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPulling(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp template manager</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {templates.length
              ? `${templates.length} template${templates.length === 1 ? "" : "s"} in this folder.`
              : "No templates yet. Start from one of the examples."}
            {writable ? null : " Read-only here, because the disk is."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FeedbackButton feedback={feedback} />
          <Decoder />
          {connected ? (
            <Button variant="outline" onClick={pull} disabled={pulling}>
              <Download />
              {pulling ? "Reading…" : "Read the account"}
            </Button>
          ) : null}
          <NewTemplate writable={writable} />
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, category or wording"
          className="w-full max-w-xs"
        />
        <div className="bg-muted ml-auto flex shrink-0 gap-0.5 rounded-lg p-0.5">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setFilter(entry.id)}
              className={cn(
                "rounded-[7px] px-2.5 py-1.5 text-xs font-medium transition-colors",
                filter === entry.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <Button
          variant={onlyFeedback ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyFeedback(!onlyFeedback)}
          title="Only the templates with feedback waiting"
        >
          <MessageSquare />
          Feedback
        </Button>
      </div>

      {connected ? null : (
        <p className="text-muted-foreground mb-6 text-xs">
          Approved and in review come from the account. Until a token is set up, a template is
          either ready to submit or not.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">Nothing here matches that.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((row) => (
            <Link
              key={row.key}
              href={`/t/${row.key}`}
              onContextMenu={(event) => {
                event.preventDefault();
                openFeedback(row.key);
              }}
              className="hover:border-foreground/25 flex flex-col overflow-hidden rounded-xl border transition-colors"
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <code className="truncate text-xs font-medium">{row.template.name}</code>
                <Badge variant="outline" className="ml-auto shrink-0 text-[10px] uppercase">
                  {row.template.language}
                </Badge>
              </div>
              <Preview
                template={row.template}
                fade
                className="h-[236px] rounded-none border-x-0 border-y"
              />
              <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
                <span className={cn("font-medium", TONE[row.stage.tone])} title={row.stage.detail}>
                  {row.stage.label}
                </span>
                <span className="text-muted-foreground capitalize">
                  {row.template.category.toLowerCase()}
                </span>
                {row.open > 0 ? (
                  <span className="text-muted-foreground ml-auto flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {row.open}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}

      <FeedbackPanel
        feedback={feedback}
        templates={rows.map((row) => row.key)}
        writable={writable}
      />
    </main>
  );
}

function NewTemplate({ writable }: { writable: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function create(template: Template) {
    const response = await fetch("/api/templates", {
      method: "POST",
      body: JSON.stringify(template),
    });
    const answer = await response.json();
    if (!response.ok) return toast.error(answer.error);
    setOpen(false);
    router.push(`/t/${answer.key}`);
  }

  if (!writable) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            New template
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start from</DialogTitle>
          <DialogDescription>
            Every one of these passes review as it stands. Change the wording, keep the shape.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.id}
              onClick={() => create(structuredClone(starter.template))}
              className="hover:border-foreground/30 rounded-lg border p-3 text-left transition-colors"
            >
              <div className="text-sm font-medium">{starter.title}</div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{starter.about}</p>
              <p className="text-muted-foreground/70 mt-2 line-clamp-2 text-xs">
                {toPlain(
                  (
                    starter.template.components.find((component) => component.type === "BODY") as
                      | { text?: string }
                      | undefined
                  )?.text ?? "",
                )}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
