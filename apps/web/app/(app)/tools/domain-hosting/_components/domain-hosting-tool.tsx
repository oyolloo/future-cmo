"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { GlobeIcon as Globe } from "@kit/ui/icons";
import { Input } from "@kit/ui/input";

import {
  auditDomainAction,
  type DomainAuditState,
} from "../_lib/actions";

import { DomainAuditResults } from "./domain-audit-results";
import { DomainAuditSkeleton } from "./domain-audit-skeleton";

export function DomainHostingTool() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<DomainAuditState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await auditDomainAction(input);
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
            <label htmlFor="domain" className="text-label block">
              Domain or URL
            </label>
            <Input
              id="domain"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="example.com  or  https://example.com"
              required
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !input.trim()}
            className="w-full md:w-auto"
          >
            {isPending ? "Looking up…" : "Lookup"}
          </Button>
        </div>

        {state && !state.ok ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {state.error.message}
          </p>
        ) : null}
      </form>

      {isPending ? (
        <DomainAuditSkeleton />
      ) : state?.ok ? (
        <DomainAuditResults data={state.data} />
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
        <Globe className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-medium">
        Everything you need to know about a domain
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Registrar · expiry date · hosting provider · server location · DNS
        records · email security (SPF / DMARC) · DNSSEC.
      </p>
      <p className="text-comment mt-3">
        {"// paste a domain or URL above to start · typically 2–5 seconds"}
      </p>
    </section>
  );
}
