"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { SparklesIcon as Sparkles } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";

import { auditAISeoAction, type AISeoState } from "../_lib/actions";

import { AISeoResults } from "./ai-seo-results";
import { AISeoSkeleton } from "./ai-seo-skeleton";

export function AISeoTool() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<AISeoState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await auditAISeoAction(url);
      setState(result);
    });
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="url" className="text-label block">
              Page URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/blog/your-best-article"
              required
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !url.trim()}
            className="w-full md:w-auto"
          >
            {isPending ? "Auditing…" : "Audit"}
          </Button>
        </div>

        {state && !state.ok ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {state.error.message}
          </p>
        ) : null}
      </form>

      {isPending ? (
        <AISeoSkeleton />
      ) : state?.ok ? (
        <AISeoResults data={state.data} />
      ) : !state ? (
        <EmptyHint />
      ) : null}
    </div>
  );
}

function EmptyHint() {
  return (
    <section className="rounded-lg border border-border bg-card p-10 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-muted">
        <Sparkles className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-medium">
        Will ChatGPT, Claude, Perplexity, and Gemini cite this page?
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Audit for AI-search citability: schema markup, content structure,
        AI-bot access, brand entity signals, and authority markers.
      </p>
      <p className="text-comment mt-3">
        {"// paste a page URL above to start · ~10–20 s including AI verdict"}
      </p>
    </section>
  );
}
