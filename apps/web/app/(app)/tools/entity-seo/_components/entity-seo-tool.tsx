"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { NetworkIcon as Network } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";

import {
  analyzeEntitySeoAction,
  type EntitySeoState,
} from "../_lib/actions";

import { EntitySeoResults } from "./entity-seo-results";
import { EntitySeoSkeleton } from "./entity-seo-skeleton";

export function EntitySeoTool() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<EntitySeoState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await analyzeEntitySeoAction(url);
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
              placeholder="https://example.com/about"
              required
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
        <EntitySeoSkeleton />
      ) : state?.ok ? (
        <EntitySeoResults data={state.data} />
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
        <Network className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-medium">
        Knowledge-graph alignment audit
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Different from Semantic SEO (which checks topical breadth). Entity SEO
        zooms in on the named entities the page already mentions — are they
        properly defined, linked, and marked up so Google + LLMs connect them
        to the knowledge graph?
      </p>
      <p className="text-comment mt-3">
        {"// paste a URL above to start · ~10–20 s LLM analysis"}
      </p>
    </section>
  );
}
