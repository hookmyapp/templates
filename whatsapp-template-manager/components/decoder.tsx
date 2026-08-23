"use client";

import { useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { decode, type Template } from "@/lib/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Paste what Meta said, read what it meant.
 *
 * Whatever came back goes in: the whole JSON error, the sentence out of
 * WhatsApp Manager, or a bare `INCORRECT_CATEGORY`. With a template open, the
 * answer also names the fields that would have caused it.
 */
export function Decoder({
  template,
  initial,
  label = "Why was it rejected?",
}: {
  template?: Template;
  initial?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const found = useMemo(() => (text.trim() ? decode(text, template) : []), [text, template]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <CircleHelp />
            {label}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Read the rejection</DialogTitle>
          <DialogDescription>
            Paste the error, the reason word, or the whole response body.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='{"error":{"code":132007,"message":"Template format character policy violated"}}'
          className="font-mono text-xs"
        />

        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {found.map((diagnosis, index) => (
            <div key={index} className="rounded-lg border p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{diagnosis.title}</h3>
                <Badge variant={diagnosis.certain ? "default" : "outline"} className="text-[10px]">
                  {diagnosis.certain ? diagnosis.matched : "best guess"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">{diagnosis.cause}</p>
              <ol className="mt-2 space-y-1 text-xs">
                {diagnosis.fix.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
              {diagnosis.issues?.length ? (
                <div className="mt-2.5 border-t pt-2.5">
                  <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                    In this template
                  </p>
                  <ul className="space-y-1 text-xs">
                    {diagnosis.issues.map((issue, i) => (
                      <li key={i}>
                        <code className="text-muted-foreground text-[11px]">{issue.path}</code>{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
          {text.trim() && found.length === 0 ? (
            <p className="text-muted-foreground text-xs">Nothing to say about that yet.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
