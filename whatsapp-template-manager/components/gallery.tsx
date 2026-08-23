"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Download, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import { STARTERS, keyOf, toPlain, validate, type Template } from "@/lib/core";
import type { Feedback } from "@/lib/store";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Filter = "all" | "clean" | "problems" | "notes";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "clean", label: "Ready" },
  { id: "problems", label: "Needs work" },
  { id: "notes", label: "Has feedback" },
];

/** Anything else in the URL, including nothing, means show everything. */
function asFilter(value: string | null): Filter {
  return FILTERS.some((entry) => entry.id === value) ? (value as Filter) : "all";
}

export function Gallery({
  templates,
  feedback,
  writable,
  connected,
}: {
  templates: Template[];
  feedback: Feedback[];
  writable: boolean;
  connected: boolean;
}) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>(() => asFilter(params.get("show")));
  const [pulling, setPulling] = useState(false);
  const router = useRouter();

  // The search and the filter live in the URL, so a refresh keeps them and the
  // view can be sent to someone. This writes the address directly rather than
  // routing: the filtering is done here in the browser, and asking the router
  // for a new URL would fetch the page again on every keystroke.
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (filter !== "all") next.set("show", filter);
    const search = next.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, [query, filter]);

  const rows = useMemo(
    () =>
      templates.map((template) => {
        const key = keyOf(template);
        const result = validate(template);
        const body = template.components.find((component) => component.type === "BODY");
        return {
          key,
          template,
          result,
          open: feedback.filter((note) => note.template === key && note.status === "open").length,
          haystack: [key, template.category, body && "text" in body ? body.text : ""]
            .join(" ")
            .toLowerCase(),
        };
      }),
    [templates, feedback],
  );

  const shown = rows.filter((row) => {
    if (query && !row.haystack.includes(query.toLowerCase())) return false;
    if (filter === "clean") return row.result.ok && row.result.warnings.length === 0;
    if (filter === "problems") return !row.result.ok || row.result.warnings.length > 0;
    if (filter === "notes") return row.open > 0;
    return true;
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, category or wording"
          className="w-full max-w-sm"
        />
        <div className="bg-muted flex shrink-0 gap-0.5 rounded-lg p-0.5">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setFilter(entry.id)}
              className={cn(
                "rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors",
                filter === entry.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Nothing here matches that.
        </p>
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
                <Status result={row.result} />
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
              <div className="text-muted-foreground flex items-center gap-3 px-3 py-2.5 text-xs">
                <span className="capitalize">{row.template.category.toLowerCase()}</span>
                {row.open > 0 ? (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {row.open} open
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

function Status({ result }: { result: ReturnType<typeof validate> }) {
  if (!result.ok) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
        <CircleAlert className="size-3.5" />
        {result.errors.length}
      </span>
    );
  }
  if (result.warnings.length) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
        <TriangleAlert className="size-3.5" />
        {result.warnings.length}
      </span>
    );
  }
  return <CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />;
}

function NewTemplate({ writable }: { writable: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function create(template: Template) {
    const response = await fetch("/api/templates", { method: "POST", body: JSON.stringify(template) });
    const answer = await response.json();
    if (!response.ok) return toast.error(answer.error);
    setOpen(false);
    router.push(`/t/${answer.key}`);
  }

  if (!writable) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus />New template</Button>} />
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
              className={cn(
                "hover:border-foreground/30 rounded-lg border p-3 text-left transition-colors",
              )}
            >
              <div className="text-sm font-medium">{starter.title}</div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{starter.about}</p>
              <p className="text-muted-foreground/70 mt-2 line-clamp-2 text-xs">
                {toPlain(
                  (starter.template.components.find((component) => component.type === "BODY") as
                    | { text?: string }
                    | undefined)?.text ?? "",
                )}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
