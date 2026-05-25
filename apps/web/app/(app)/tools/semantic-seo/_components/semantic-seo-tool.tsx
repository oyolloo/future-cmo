"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { NetworkIcon as Network } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";

import {
  analyzeSemanticSeoAction,
  type SemanticSeoState,
} from "../_lib/actions";

import { SemanticSeoResults } from "./semantic-seo-results";
import { SemanticSeoSkeleton } from "./semantic-seo-skeleton";

export function SemanticSeoTool() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<SemanticSeoState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await analyzeSemanticSeoAction(url);
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
              placeholder="https://example.com/blog/your-article"
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
        <SemanticSeoSkeleton />
      ) : state?.ok ? (
        <SemanticSeoResults data={state.data} />
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
        Topical authority audit — entities & coverage gaps
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Modern search ranking is about entity coverage, not keyword density.
        Paste a URL → see what entities the page already covers, what&apos;s
        missing for topical completeness, and concrete content additions to
        close the gap.
      </p>
      <p className="text-comment mt-3">
        {"// paste a URL above to start · ~10–20 s LLM analysis"}
      </p>
    </section>
  );
}
