"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { GaugeIcon as Gauge, SmartphoneIcon as Smartphone } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import {
  runPagespeedAction,
  type RunPagespeedState,
} from "../_lib/actions";

import { PagespeedResults } from "./pagespeed-results";
import { PagespeedSkeleton } from "./pagespeed-skeleton";

type Strategy = "mobile" | "desktop";

export function WebsiteSpeedTool() {
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("mobile");
  const [state, setState] = useState<RunPagespeedState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await runPagespeedAction(url, strategy);
      setState(result);
    });
  };

  const onStrategyChange = (next: Strategy) => {
    setStrategy(next);
    // If we already have a result, re-run for the new strategy.
    if (state && url.trim()) {
      startTransition(async () => {
        const result = await runPagespeedAction(url, next);
        setState(result);
      });
    }
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
              Website URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <span className="text-label block">Strategy</span>
            <StrategyToggle
              value={strategy}
              onChange={onStrategyChange}
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
        <PagespeedSkeleton />
      ) : state?.ok ? (
        <PagespeedResults data={state.data} />
      ) : !state ? (
        <EmptyHint />
      ) : null}
    </div>
  );
}

function StrategyToggle({
  value,
  onChange,
  disabled,
}: {
  value: Strategy;
  onChange: (next: Strategy) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="PageSpeed strategy"
      className="inline-flex items-center rounded-lg border border-border bg-background p-0.5"
    >
      <StrategyButton
        active={value === "mobile"}
        onClick={() => onChange("mobile")}
        disabled={disabled}
      >
        <Smartphone className="size-3.5" />
        Mobile
      </StrategyButton>
      <StrategyButton
        active={value === "desktop"}
        onClick={() => onChange("desktop")}
        disabled={disabled}
      >
        <Gauge className="size-3.5" />
        Desktop
      </StrategyButton>
    </div>
  );
}

function StrategyButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyHint() {
  return (
    <section className="rounded-lg border border-border bg-card p-10 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-muted">
        <Gauge className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-medium">
        Measure your website&apos;s real performance
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Lighthouse audit + Core Web Vitals + opportunities — powered by Google
        PageSpeed Insights.
      </p>
      <p className="text-comment mt-3">
        {"// paste a URL above to start · full audit (perf + a11y + best practices + SEO) typically 30–90 s, heavy pages up to 3 min"}
      </p>
    </section>
  );
}
