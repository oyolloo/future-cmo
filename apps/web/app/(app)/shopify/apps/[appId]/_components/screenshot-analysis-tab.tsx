"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import type { ImageAnalysis } from "@/lib/ai/image-analyzer";

import { analyzeScreenshotAction, generateImageAction } from "../_lib/actions";

type Props = {
  screenshots: string[];
  appName: string;
};

export function ScreenshotAnalysisTab({ screenshots, appName }: Props) {
  const [selected, setSelected] = useState(0);
  const [analyses, setAnalyses] = useState<Map<number, ImageAnalysis>>(new Map());
  const [errors, setErrors] = useState<Map<number, string>>(new Map());
  const [isPending, startTransition] = useTransition();

  // Generation
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isGenerating, startGenTransition] = useTransition();

  if (screenshots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No screenshots available. Click &quot;Sync now&quot; to fetch listing data.
        </p>
      </div>
    );
  }

  const currentUrl = screenshots[selected]!;
  const hiRes = currentUrl.replace(/\?.*$/, "");
  const currentAnalysis = analyses.get(selected);
  const currentError = errors.get(selected);

  const onAnalyze = () => {
    startTransition(async () => {
      const res = await analyzeScreenshotAction(hiRes, appName);
      if (res.ok) {
        setAnalyses((prev) => new Map(prev).set(selected, res.data));
        setErrors((prev) => { const n = new Map(prev); n.delete(selected); return n; });
      } else {
        setErrors((prev) => new Map(prev).set(selected, res.error.message));
      }
    });
  };

  const onGenerate = (prompt: string) => {
    setGenError(null);
    setGeneratedUrl(null);
    startGenTransition(async () => {
      const res = await generateImageAction(prompt);
      if (res.ok) {
        setGeneratedUrl(res.data.url);
      } else {
        setGenError(res.error.message);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Screenshot selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {screenshots.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => { setSelected(i); setGeneratedUrl(null); setGenError(null); }}
            className={cn(
              "shrink-0 overflow-hidden rounded-md border-2 transition-colors",
              i === selected
                ? "border-primary"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <img
              src={src.replace(/\?.*$/, "") + "?width=320&height=180"}
              alt={`Screenshot ${i + 1}`}
              className="h-14 w-20 object-cover"
            />
          </button>
        ))}
      </div>

      {/* Current screenshot */}
      <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
        <img src={hiRes} alt={`${appName} screenshot`} className="w-full object-contain" />
      </div>

      {/* Analyze button */}
      {!currentAnalysis && !isPending ? (
        <Button onClick={onAnalyze} disabled={isPending}>
          Analyze this screenshot
        </Button>
      ) : null}

      {isPending ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <div className="mx-auto size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Analyzing with AI vision…</p>
        </div>
      ) : null}

      {currentError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{currentError}</p>
        </div>
      ) : null}

      {/* Analysis results */}
      {currentAnalysis ? (
        <ScreenshotAnalysis
          analysis={currentAnalysis}
          imageUrl={hiRes}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
          generatedUrl={generatedUrl}
          genError={genError}
        />
      ) : null}
    </div>
  );
}

// ─── Analysis display ────────────────────────────────────────────────

function ScreenshotAnalysis({
  analysis,
  imageUrl,
  onGenerate,
  isGenerating,
  generatedUrl,
  genError,
}: {
  analysis: ImageAnalysis;
  imageUrl: string;
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  generatedUrl: string | null;
  genError: string | null;
}) {
  const [promptEdited, setPromptEdited] = useState(analysis.improvementPrompt);

  const categories = [
    { key: "composition" as const, label: "Composition" },
    { key: "typography" as const, label: "Typography" },
    { key: "colorAndContrast" as const, label: "Color" },
    { key: "clarity" as const, label: "Clarity" },
    { key: "brandConsistency" as const, label: "Brand" },
  ];

  return (
    <div className="space-y-4">
      {/* Score + verdict */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full border-[3px] font-mono text-sm font-semibold",
            analysis.overallScore >= 70
              ? "border-[oklch(0.72_0.14_160/40%)] text-[oklch(0.80_0.14_160)]"
              : analysis.overallScore >= 40
                ? "border-[oklch(0.78_0.14_90/40%)] text-[oklch(0.85_0.14_90)]"
                : "border-destructive/40 text-destructive",
          )}
        >
          {analysis.overallScore}
        </span>
        <p className="text-sm text-foreground">{analysis.verdict}</p>
      </div>

      {/* Category scores — compact row */}
      <div className="grid grid-cols-5 gap-2">
        {categories.map(({ key, label }) => {
          const cat = analysis[key];
          return (
            <div key={key} className="rounded-md border border-border bg-card px-2 py-2 text-center">
              <p className={cn("font-mono text-sm font-semibold", scoreColor(cat.score))}>{cat.score}</p>
              <p className="mt-0.5 text-[0.6rem] text-muted-foreground">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Issues */}
      <div className="space-y-2">
        {analysis.issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2">
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded px-1 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider",
                issue.priority === "high"
                  ? "bg-destructive/10 text-destructive"
                  : issue.priority === "medium"
                    ? "bg-[oklch(0.78_0.14_90/10%)] text-[oklch(0.85_0.14_90)]"
                    : "bg-muted/40 text-muted-foreground",
              )}
            >
              {issue.priority}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-foreground">{issue.area}: {issue.issue}</p>
              <p className="mt-0.5 text-[0.6875rem] text-[oklch(0.80_0.14_160)]">→ {issue.fix}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Generate */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-label text-primary">→ Generate improved version</p>
        <textarea
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          rows={4}
          value={promptEdited}
          onChange={(e) => setPromptEdited(e.target.value)}
          disabled={isGenerating}
        />
        <div className="mt-2 flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => onGenerate(promptEdited)}
            disabled={isGenerating || !promptEdited.trim()}
          >
            {isGenerating ? "Generating…" : "Generate"}
          </Button>
          <span className="text-comment">{"// ~$0.04–0.08 per image"}</span>
        </div>
      </div>

      {isGenerating ? (
        <div className="rounded-md border border-border bg-card p-4 text-center">
          <div className="mx-auto size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-xs text-muted-foreground">Generating… 15–30s</p>
        </div>
      ) : null}

      {genError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <p className="text-xs text-destructive">{genError}</p>
        </div>
      ) : null}

      {generatedUrl ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-label text-[oklch(0.80_0.14_160)]">Generated</p>
              <a
                href={generatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[0.625rem] text-primary hover:underline"
              >
                open full size
              </a>
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border border-border bg-muted/30">
              <img src={generatedUrl} alt="Generated" className="w-full object-contain" />
            </div>
          </div>

          {/* Side by side */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[0.625rem] text-muted-foreground">ORIGINAL</p>
              <img src={imageUrl} alt="Original" className="w-full rounded-md border border-border object-contain" />
            </div>
            <div>
              <p className="mb-1 text-[0.625rem] text-[oklch(0.80_0.14_160)]">AI GENERATED</p>
              <img src={generatedUrl} alt="Generated" className="w-full rounded-md border border-[oklch(0.72_0.14_160/30%)] object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-[oklch(0.80_0.14_160)]";
  if (score >= 40) return "text-[oklch(0.85_0.14_90)]";
  return "text-destructive";
}
