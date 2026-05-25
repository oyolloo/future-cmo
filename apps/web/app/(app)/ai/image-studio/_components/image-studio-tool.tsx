"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import type { ImageAnalysis } from "@/lib/ai/image-analyzer";

import { analyzeImageAction, generateImageAction } from "../_lib/actions";
import { AnalysisResults } from "./analysis-results";

export function ImageStudioTool() {
  const [imageUrl, setImageUrl] = useState("");
  const [context, setContext] = useState("");
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Generation state
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isGenerating, startGenTransition] = useTransition();

  const onAnalyze = () => {
    if (!imageUrl.trim()) return;
    setError(null);
    setAnalysis(null);
    setGeneratedUrl(null);
    setGenError(null);

    startTransition(async () => {
      const res = await analyzeImageAction(imageUrl.trim(), context.trim() || undefined);
      if (res.ok) {
        setAnalysis(res.data);
        setAnalyzedUrl(imageUrl.trim());
      } else {
        setError(res.error.message);
      }
    });
  };

  const onGenerate = (prompt: string) => {
    setGenError(null);
    setGeneratedUrl(null);
    startGenTransition(async () => {
      const res = await generateImageAction(prompt, {
        size: "1792x1024",
        quality: "standard",
        style: "vivid",
      });
      if (res.ok) {
        setGeneratedUrl(res.data.url);
      } else {
        setGenError(res.error.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Input form */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Image URL</p>
        <div className="mt-3 space-y-3">
          <Input
            type="url"
            placeholder="https://cdn.shopify.com/...screenshot.png"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={isPending}
          />
          <Input
            type="text"
            placeholder="Context (optional) — e.g. 'Shopify app listing screenshot for a table builder app'"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={isPending}
          />
          <Button onClick={onAnalyze} disabled={isPending || !imageUrl.trim()}>
            {isPending ? "Analyzing…" : "Analyze image"}
          </Button>
        </div>
      </div>

      {/* Preview */}
      {imageUrl.trim() && !isPending && !analysis ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-label">Preview</p>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted/30">
            <img
              src={imageUrl.trim().replace(/\?.*$/, "")}
              alt="Preview"
              className="w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Loading */}
      {isPending ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Analyzing image with AI vision model…
          </p>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {/* Results */}
      {analysis && analyzedUrl ? (
        <AnalysisResults
          imageUrl={analyzedUrl}
          analysis={analysis}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
          generatedUrl={generatedUrl}
          genError={genError}
        />
      ) : null}
    </div>
  );
}
