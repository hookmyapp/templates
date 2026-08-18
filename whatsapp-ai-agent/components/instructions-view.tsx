"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { Status } from "@/components/status";
import { cn } from "@/lib/utils";

type Model = { id: string; name: string };

export function InstructionsView({
  status,
  onChange,
  onSettings,
}: {
  status: Status;
  onChange: () => void;
  onSettings: () => void;
}) {
  const [prompt, setPrompt] = useState(status.systemPrompt);
  const [model, setModel] = useState(status.model);
  const [temperature, setTemperature] = useState(status.temperature);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<Model[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModels(d.connected ? (d.models ?? []) : null))
      .catch(() => setModels(null));
  }, []);

  const dirty =
    prompt !== status.systemPrompt ||
    model !== status.model ||
    temperature !== status.temperature;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: prompt, model, temperature }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Saved. The next message uses it.");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">Instructions</h2>
          <p className="text-muted-foreground text-sm">
            The system prompt every incoming message is answered with.
          </p>
        </div>
        <Button onClick={save} disabled={busy || !dirty}>
          Save changes
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          spellCheck={false}
          className="min-h-[420px] resize-none font-mono text-sm leading-relaxed lg:h-full"
        />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Model configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Model</Label>
              {models ? (
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                      />
                    }
                  >
                    <span className="truncate">{model}</span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search models" />
                      <CommandList>
                        <CommandEmpty>No model matches.</CommandEmpty>
                        <CommandGroup>
                          {models.map((m) => (
                            <CommandItem
                              key={m.id}
                              value={m.id}
                              onSelect={(v) => {
                                setModel(v);
                                setOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "size-4",
                                  model === m.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="truncate">{m.id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onSettings}
                >
                  <KeyRound className="size-4" />
                  Add your OpenRouter key
                </Button>
              )}
            </div>
            {models ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-muted-foreground font-mono text-xs">
                    {temperature.toFixed(1)}
                  </span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[temperature]}
                  onValueChange={(v) =>
                    setTemperature(Array.isArray(v) ? v[0] : v)
                  }
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>Reserved</span>
                  <span>Creative</span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
