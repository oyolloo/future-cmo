"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";

import { addAppAction } from "../_lib/actions";

export function AddAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open ? (
        <div className="self-end">
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            + Add new
          </Button>
        </div>
      ) : null}

      {/* Form renders AFTER the header (as a sibling in the parent
          space-y stack) via a CSS hack: break out of the header flex
          with `basis-full` so it drops to its own line, full width. */}
      {open ? (
        <div className="w-full basis-full">
          <AddAppForm onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}

function AddAppForm({ onClose }: { onClose: () => void }) {
  const [orgId, setOrgId] = useState("");
  const [token, setToken] = useState("");
  const [appId, setAppId] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await addAppAction({
        organizationId: orgId,
        accessToken: token,
        appId,
        appStoreUrl: storeUrl.trim() || undefined,
      });
      if (result.ok) {
        setMessage({
          kind: "ok",
          text: `Added "${result.appName}". Click Sync to pull events.`,
        });
        setAppId("");
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage({ kind: "err", text: result.error.message });
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-label">Connect a Shopify app</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1">
        <div className="space-y-2">
          <Label htmlFor="org" className="text-label">
            Partner Organization ID
          </Label>
          <Input
            id="org"
            type="text"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="e.g. 1234567"
            required
            disabled={isPending}
            inputMode="numeric"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="token" className="text-label">
            Partner API Access Token
          </Label>
          <Input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="prtapi_…"
            required
            disabled={isPending}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="appId" className="text-label">
            Shopify App ID
          </Label>
          <Input
            id="appId"
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="123456"
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="storeUrl" className="text-label">
            App Store URL <span className="text-muted-foreground/50">(optional)</span>
          </Label>
          <Input
            id="storeUrl"
            type="url"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="https://apps.shopify.com/your-app-slug"
            disabled={isPending}
          />
          <p className="text-comment">
            {"// paste from your Shopify App Store listing page — auto-detected if left blank"}
          </p>
        </div>
      </div>

      {message ? (
        <p
          role={message.kind === "err" ? "alert" : "status"}
          className={
            message.kind === "err"
              ? "mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              : "mt-4 rounded-md border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] px-3 py-2 text-xs text-[oklch(0.80_0.14_160)]"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="submit"
          disabled={
            isPending || !orgId.trim() || !token.trim() || !appId.trim()
          }
        >
          {isPending ? "Connecting…" : "Connect app"}
        </Button>
        <p className="text-comment">
          {"// credentials encrypted per-app · org ID from Partner Dashboard URL"}
        </p>
      </div>
    </form>
  );
}
