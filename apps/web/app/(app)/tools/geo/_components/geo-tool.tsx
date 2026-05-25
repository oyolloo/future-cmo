"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { SparklesIcon as Sparkles } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";

import { analyzeGeoAction, type GeoState } from "../_lib/actions";

import { GeoResults } from "./geo-results";
import { GeoSkeleton } from "./geo-skeleton";

export function GeoTool() {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [state, setState] = useState<GeoState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await analyzeGeoAction(url, topic);
      setState(result);
    });
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <label htmlFor="url" className="text-label block">
              Page URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="topic" className="text-label block">
              Target topic <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. roofing services in Phoenix"
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !url.trim()}
            className="w-full md:w-auto"
          >
            {isPending ? "Analyzing…" : "Analyze"}
          </Button>
        </div>

        {state && !state.ok ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {state.error.message}
          </p>
        ) : null}
      </form>

      {isPending ? (
        <GeoSkeleton />
      ) : state?.ok ? (
        <GeoResults data={state.data} />
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
        Would AI engines actually cite this page?
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Different from AI SEO (which checks structural readiness). GEO
        simulates real user queries against ChatGPT / Perplexity / Gemini /
        Claude and grades how likely each engine is to <em>cite this page</em>
        when answering. Plus a sample snippet of what AI would quote.
      </p>
      <p className="text-comment mt-3">
        {"// paste a URL above to start · ~10–20 s LLM analysis"}
      </p>
    </section>
  );
}
