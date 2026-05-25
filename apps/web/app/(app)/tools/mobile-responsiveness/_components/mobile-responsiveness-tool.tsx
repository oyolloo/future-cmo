"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { SmartphoneIcon as Smartphone } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";

import {
  auditMobileAction,
  type MobileAuditState,
} from "../_lib/actions";

import { MobileAuditResults } from "./mobile-audit-results";
import { MobileAuditSkeleton } from "./mobile-audit-skeleton";

export function MobileResponsivenessTool() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<MobileAuditState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await auditMobileAction(url);
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
        <MobileAuditSkeleton />
      ) : state?.ok ? (
        <MobileAuditResults data={state.data} />
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
        <Smartphone className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-medium">
        See how a site renders on every device
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Side-by-side previews on iPhone, iPad, Pixel, Galaxy, and Desktop —
        plus a deep signals audit (viewport meta, responsive images, legacy
        plugins, accessibility flags).
      </p>
      <p className="text-comment mt-3">
        {"// paste a URL above to start · typically 10–20 seconds"}
      </p>
    </section>
  );
}
