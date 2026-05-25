"use client";

import { useState } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import type { ImageAnalysis } from "@/lib/ai/image-analyzer";

type Props = {
  imageUrl: string;
  analysis: ImageAnalysis;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  generatedUrl: string | null;
  genError: string | null;
};

const CATEGORIES = [
  { key: "composition" as const, label: "Composition", icon: "◫" },
  { key: "typography" as const, label: "Typography", icon: "Aa" },
  { key: "colorAndContrast" as const, label: "Color & Contrast", icon: "◑" },
  { key: "clarity" as const, label: "Clarity", icon: "◉" },
  { key: "brandConsistency" as const, label: "Brand", icon: "◆" },
];

export function AnalysisResults({
  imageUrl,
  analysis,
  onGenerate,
  isGenerating,
  generatedUrl,
  genError,
}: Props) {
  const [promptEdited, setPromptEdited] = useState(analysis.improvementPrompt);

  return (
    <div className="space-y-6">
      {/* Original image + score */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <ScoreCircle score={analysis.overallScore} />
            <div>
              <p className="text-label">Image Analysis Score</p>
              <p className="mt-1 text-sm text-foreground">{analysis.verdict}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-muted/30">
          <img
            src={imageUrl.replace(/\?.*$/, "")}
            alt="Analyzed image"
            className="w-full object-contain"
          />
        </div>
      </div>

      {/* Category scores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map(({ key, label, icon }) => {
          const cat = analysis[key];
          return (
            <div key={key} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-xs">
                    {icon}
                  </span>
                  <p className="text-xs font-medium text-foreground">{label}</p>
                </div>
                <span className={cn("font-mono text-lg font-semibold", scoreColor(cat.score))}>
                  {cat.score}
                </span>
              </div>
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
                {cat.feedback}
              </p>
            </div>
          );
        })}
      </div>

      {/* Issues */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Issues found · {analysis.issues.length}</p>
        <ul className="mt-3 divide-y divide-border">
          {analysis.issues.map((issue, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
                    issue.priority === "high"
                      ? "border border-destructive/30 bg-destructive/10 text-destructive"
                      : issue.priority === "medium"
                        ? "border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] text-[oklch(0.85_0.14_90)]"
                        : "border border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {issue.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {issue.area}: {issue.issue}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-[oklch(0.80_0.14_160)]">
                    Fix: {issue.fix}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Generate improved version */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <p className="text-label text-primary">
          → Generate improved version
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Edit the AI-suggested prompt below, then generate a new image concept.
        </p>
        <textarea
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          rows={5}
          value={promptEdited}
          onChange={(e) => setPromptEdited(e.target.value)}
          disabled={isGenerating}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button
            onClick={() => onGenerate(promptEdited)}
            disabled={isGenerating || !promptEdited.trim()}
          >
            {isGenerating ? "Generating…" : "Generate image"}
          </Button>
          <span className="text-comment">
            {"// ~$0.04–0.08 per image (DALL-E 3)"}
          </span>
        </div>
      </div>

      {/* Generation loading */}
      {isGenerating ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Generating image… this may take 15–30 seconds
          </p>
        </div>
      ) : null}

      {/* Generation error */}
      {genError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{genError}</p>
        </div>
      ) : null}

      {/* Generated result */}
      {generatedUrl ? (
        <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-label text-[oklch(0.80_0.14_160)]">Generated result</p>
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
            >
              open full size
            </a>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted/30">
            <img
              src={generatedUrl}
              alt="AI generated image"
              className="w-full object-contain"
            />
          </div>
        </div>
      ) : null}

      {/* Side by side comparison */}
      {generatedUrl ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-label">Before → After</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Original</p>
              <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
                <img
                  src={imageUrl.replace(/\?.*$/, "")}
                  alt="Original"
                  className="w-full object-contain"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-[oklch(0.80_0.14_160)]">AI Generated</p>
              <div className="overflow-hidden rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-muted/30">
                <img
                  src={generatedUrl}
                  alt="Generated"
                  className="w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const band =
    score >= 70
      ? "border-[oklch(0.72_0.14_160/40%)] text-[oklch(0.80_0.14_160)]"
      : score >= 40
        ? "border-[oklch(0.78_0.14_90/40%)] text-[oklch(0.85_0.14_90)]"
        : "border-destructive/40 text-destructive";
  return (
    <div
      className={cn(
        "flex size-16 items-center justify-center rounded-full border-4 font-mono text-xl font-semibold",
        band,
      )}
    >
      {score}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-[oklch(0.80_0.14_160)]";
  if (score >= 40) return "text-[oklch(0.85_0.14_90)]";
  return "text-destructive";
}
