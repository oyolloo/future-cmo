"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select";

import { LocationAutocomplete } from "../../_components/location-autocomplete";
import { createAutomationJobAction, type DelayUnit } from "../_lib/actions";
import type {
  CustomField,
  CustomFieldStored,
} from "../_lib/custom-fields-config";
import { CustomFieldsRepeater } from "./custom-fields-repeater";

type Task = {
  id: string;
  keyword: string;
  location: string;
  maxResults: number;
};

const newTaskId = () =>
  `t_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

export function AutomationTool() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([
    { id: newTaskId(), keyword: "", location: "", maxResults: 60 },
  ]);
  const [delayValue, setDelayValue] = useState<number>(0);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("minutes");
  const [customFieldsEnabled, setCustomFieldsEnabled] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addTask = () =>
    setTasks((prev) => [
      ...prev,
      { id: newTaskId(), keyword: "", location: "", maxResults: 60 },
    ]);

  const removeTask = (id: string) =>
    setTasks((prev) =>
      prev.length > 1 ? prev.filter((t) => t.id !== id) : prev,
    );

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const submit = () => {
    setError(null);
    // Drop rows missing label or value, then strip the React-only id
    const cleanCustomFields: CustomFieldStored[] = customFieldsEnabled
      ? customFields
          .filter((f) => f.value && f.label.trim())
          .map((f) => ({ label: f.label.trim(), value: f.value as CustomFieldStored["value"] }))
      : [];
    startTransition(async () => {
      const res = await createAutomationJobAction({
        tasks: tasks.map((t) => ({
          keyword: t.keyword,
          location: t.location,
          maxResults: t.maxResults,
        })),
        delayValue,
        delayUnit,
        customFields: cleanCustomFields.length > 0 ? cleanCustomFields : null,
      });
      if (res.ok) {
        router.push(`/gm-prospecting/automation/${res.jobId}`);
      } else {
        setError(res.error.message);
      }
    });
  };

  const canSubmit = tasks.some((t) => t.keyword.trim() && t.location.trim());

  return (
    <div className="space-y-6">
      {/* Task repeater */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-label">Tasks · {tasks.length}</p>
          <p className="text-comment">
            {"// each row = one search · runs sequentially in background"}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {tasks.map((t, i) => (
            <div
              key={t.id}
              className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-[auto_1fr_1fr_120px_auto]"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 font-mono text-[0.625rem] text-muted-foreground">
                {i + 1}
              </span>
              <Input
                type="text"
                placeholder="Keyword (e.g. CBD companies)"
                value={t.keyword}
                onChange={(e) => updateTask(t.id, { keyword: e.target.value })}
                disabled={isPending}
              />
              <LocationAutocomplete
                value={t.location}
                onChange={(v) => updateTask(t.id, { location: v })}
                placeholder="Location (e.g. New York, NY)"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={t.maxResults}
                  onChange={(e) =>
                    updateTask(t.id, {
                      maxResults: Math.max(
                        1,
                        Math.min(60, parseInt(e.target.value || "60", 10)),
                      ),
                    })
                  }
                  disabled={isPending}
                  className="w-full"
                />
                <span className="font-mono text-[0.625rem] text-muted-foreground">
                  max
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeTask(t.id)}
                disabled={isPending || tasks.length === 1}
                className={cn(
                  "rounded-md border border-border px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider transition-colors",
                  isPending || tasks.length === 1
                    ? "text-muted-foreground/30"
                    : "text-muted-foreground hover:border-destructive/40 hover:text-destructive",
                )}
                aria-label="Remove task"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTask}
          disabled={isPending}
          className="mt-3 w-full rounded-md border border-dashed border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          + Add task
        </button>
      </div>

      {/* Custom fields toggle + repeater */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-label">Custom report fields</p>
            <p className="text-comment mt-1">
              {"// enable to choose which columns appear in the CSV — disabled = all default columns"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={customFieldsEnabled}
            onClick={() => setCustomFieldsEnabled((v) => !v)}
            disabled={isPending}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
              customFieldsEnabled
                ? "border-primary bg-primary/30"
                : "border-border bg-muted/40",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-foreground transition-transform",
                customFieldsEnabled ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {customFieldsEnabled ? (
          <div className="mt-4">
            <CustomFieldsRepeater
              fields={customFields}
              onChange={setCustomFields}
              disabled={isPending}
            />
          </div>
        ) : null}
      </div>

      {/* Delay config */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Delay between tasks</p>
        <p className="text-comment mt-1">
          {"// 0 = run immediately after each finishes (loop mode)"}
        </p>
        <div className="mt-3 flex max-w-md items-center gap-2">
          <Input
            type="number"
            min={0}
            value={delayValue}
            onChange={(e) =>
              setDelayValue(Math.max(0, parseInt(e.target.value || "0", 10)))
            }
            disabled={isPending}
            className="flex-1"
          />
          <Select
            value={delayUnit}
            onValueChange={(v) => setDelayUnit(v as DelayUnit)}
            disabled={isPending}
          >
            <SelectTrigger className="h-9 w-32 font-mono text-xs">
              <SelectValue placeholder="minutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes" className="font-mono text-xs">
                minutes
              </SelectItem>
              <SelectItem value="hours" className="font-mono text-xs">
                hours
              </SelectItem>
              <SelectItem value="days" className="font-mono text-xs">
                days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={!canSubmit || isPending}>
          {isPending ? "Queueing…" : "▶ Queue & run in background"}
        </Button>
        <p className="text-comment">
          {"// you can close this tab — the job keeps running on the server"}
        </p>
      </div>
    </div>
  );
}
