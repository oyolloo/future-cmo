"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type { Persona, PersonaSet } from "@/lib/ai/persona-generator";

type Props = {
  data: {
    personas: PersonaSet;
    savedId: string;
    modelUsed: string;
    durationMs: number;
  };
};

export function PersonaResults({ data }: Props) {
  const { personas: set, modelUsed, durationMs } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Market context</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {set.marketContext}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {set.personas.map((p, i) => (
          <PersonaCard key={`${p.name}-${i}`} persona={p} index={i} />
        ))}
      </div>

      <p className="text-comment">
        {`// generated in ${(durationMs / 1000).toFixed(1)}s · ${modelUsed} · saved to persona library`}
      </p>
    </div>
  );
}

function PersonaCard({ persona: p, index }: { persona: Persona; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = [
    "border-primary/30",
    "border-[oklch(0.72_0.14_160/30%)]",
    "border-[oklch(0.78_0.14_90/30%)]",
    "border-[oklch(0.70_0.14_295/30%)]",
  ];

  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-card p-5",
        colors[index % colors.length],
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {p.age} · {p.role} · {p.location}
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
          P{index + 1}
        </span>
      </div>

      {/* Quote */}
      <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-xs italic leading-relaxed text-muted-foreground">
        &ldquo;{p.quote}&rdquo;
      </blockquote>

      {/* Pain points */}
      <div className="mt-4">
        <p className="text-label">Pain points</p>
        <ul className="mt-1.5 space-y-1">
          {p.painPoints.map((pp, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
              <span className="mt-0.5 text-destructive" aria-hidden>▲</span>
              {pp}
            </li>
          ))}
        </ul>
      </div>

      {/* Goals */}
      <div className="mt-3">
        <p className="text-label">Goals</p>
        <ul className="mt-1.5 space-y-1">
          {p.goals.map((g, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
              <span className="mt-0.5 text-[oklch(0.80_0.14_160)]" aria-hidden>✓</span>
              {g}
            </li>
          ))}
        </ul>
      </div>

      {/* Messaging hook */}
      <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="font-mono text-[0.625rem] uppercase tracking-wider text-primary">
          Hook
        </p>
        <p className="mt-1 text-xs font-medium text-foreground">
          {p.messaging.hook}
        </p>
      </div>

      {/* Expand for full details */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 font-mono text-[0.6875rem] text-primary hover:underline"
      >
        {expanded ? "— collapse" : "+ full details"}
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs">
          <Section title="Demographics">
            <Row label="Income" value={p.demographics.income} />
            <Row label="Education" value={p.demographics.education} />
            <Row label="Family" value={p.demographics.familyStatus} />
          </Section>

          <Section title="Psychographics">
            <Row label="Values" value={p.psychographics.values.join(" · ")} />
            <Row label="Interests" value={p.psychographics.interests.join(" · ")} />
            <Row label="Personality" value={p.psychographics.personality} />
          </Section>

          <Section title="Objections">
            {p.objections.map((o, i) => (
              <p key={i} className="text-muted-foreground">• {o}</p>
            ))}
          </Section>

          <Section title="Channels">
            <Row label="Primary" value={p.channels.primary.join(" · ")} />
            {p.channels.secondary.length > 0 ? (
              <Row label="Secondary" value={p.channels.secondary.join(" · ")} />
            ) : null}
          </Section>

          <Section title="Messaging">
            <Row label="Tone" value={p.messaging.tone} />
            <Row label="Avoid" value={p.messaging.avoidWords.join(", ")} />
            <Row label="Sample headline" value={p.messaging.sampleHeadline} />
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-label">{title}</p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-muted-foreground">
      <span className="text-foreground">{label}:</span> {value}
    </p>
  );
}
