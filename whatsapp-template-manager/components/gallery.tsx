"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Download, MessageSquare, Plus, TriangleAlert } from "lucide-react";
import { STARTERS, keyOf, toPlain, validate, type Template } from "@/lib/core";
import type { Comment } from "@/lib/store";
import { Preview } from "@/components/preview";
import { Decoder } from "@/components/decoder";
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
  { id: "notes", label: "Has notes" },
];

export function Gallery({
  templates,
  notes,
  writable,
  connected,
}: {
  templates: Template[];
  notes: Comment[];
  writable: boolean;
  connected: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pulling, setPulling] = useState(false);
  const router = useRouter();

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
          open: notes.filter((note) => note.template === key && note.status === "open").length,
          haystack: [key, template.category, body && "text" in body ? body.text : ""]
            .join(" ")
            .toLowerCase(),
        };
      }),
    [templates, notes],
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

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, category or wording"
          className="max-w-sm"
        />
        <div className="flex gap-1">
          {FILTERS.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              variant={filter === entry.id ? "default" : "ghost"}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </Button>
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
              className="hover:border-foreground/20 group rounded-xl border p-3 transition-colors"
            >
              <div className="mb-2.5 flex items-center gap-2">
                <Status result={row.result} />
                <code className="truncate text-xs font-medium">{row.template.name}</code>
                <Badge variant="outline" className="ml-auto shrink-0 text-[10px] uppercase">
                  {row.template.language}
                </Badge>
              </div>
              <Preview template={row.template} />
              <div className="text-muted-foreground mt-2.5 flex items-center gap-3 text-xs">
                <span>{row.template.category.toLowerCase()}</span>
                {row.open > 0 ? (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {row.open} note{row.open === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
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
