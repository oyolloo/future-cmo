"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CheckIcon as Check, ShareIcon as Share2 } from "@kit/ui/icons";

import { createShareLinkAction } from "../_lib/actions";

export function ShareButton({ placeIds }: { placeIds: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [justShared, setJustShared] = useState(false);

  const onClick = () => {
    if (placeIds.length === 0) {
      toast.error("Nothing to share — add some businesses first");
      return;
    }

    startTransition(async () => {
      const result = await createShareLinkAction(placeIds);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }

      const absoluteUrl = `${window.location.origin}${result.url}`;
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        toast.success("Link copied to clipboard", {
          description: absoluteUrl,
        });
        setJustShared(true);
        setTimeout(() => setJustShared(false), 2000);
      } catch {
        // Clipboard blocked — still surface the URL so the user can copy it.
        toast.success("Share link created", { description: absoluteUrl });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-xs uppercase tracking-wider text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {justShared ? (
        <Check className="size-3.5 text-[oklch(0.72_0.14_160)]" />
      ) : (
        <Share2 className="size-3.5" />
      )}
      <span>
        {isPending
          ? "Creating link…"
          : justShared
            ? "Copied!"
            : "Share Report"}
      </span>
    </button>
  );
}
