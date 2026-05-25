"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";

import {
  deleteCredentialsAction,
  saveCredentialsAction,
} from "../_lib/actions";

type Props = {
  /** True if creds already exist on this user. Switches UI to "update / disconnect". */
  hasExisting: boolean;
  /** Existing organization ID — shown as the current value, not the secret token. */
  existingOrgId: string | null;
};

export function CredentialsForm({ hasExisting, existingOrgId }: Props) {
  const [organizationId, setOrganizationId] = useState(existingOrgId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveCredentialsAction({
        organizationId,
        accessToken,
      });
      if (result.ok) {
        setAccessToken("");
        setMessage({ kind: "ok", text: "Credentials saved + verified." });
      } else {
        setMessage({ kind: "err", text: result.error.message });
      }
    });
  };

  const onDisconnect = () => {
    if (!confirm("Disconnect your Shopify Partner credentials? Apps + events stay; sync stops working.")) return;
    startTransition(async () => {
      const result = await deleteCredentialsAction();
      if (result.ok) {
        setOrganizationId("");
        setAccessToken("");
        setMessage({ kind: "ok", text: "Credentials disconnected." });
      } else {
        setMessage({ kind: "err", text: result.error.message });
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-lg border border-border bg-card p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="org" className="text-label">
          Partner organization ID
        </Label>
        <Input
          id="org"
          type="text"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="e.g. 1234567"
          required
          disabled={isPending}
          inputMode="numeric"
        />
        <p className="text-comment">
          {"// numeric ID from the Partner Dashboard URL: partners.shopify.com/<ORG_ID>/…"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="token" className="text-label">
          Partner API access token
        </Label>
        <Input
          id="token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={
            hasExisting
              ? "(leave blank to keep existing — fill to replace)"
              : "prtapi_…"
          }
          required={!hasExisting}
          disabled={isPending}
          autoComplete="off"
        />
        <p className="text-comment">
          {"// Partner Dashboard → Settings → Partner API clients → create client with Manage apps permission. Stored AES-256-GCM encrypted."}
        </p>
      </div>

      {message ? (
        <p
          role={message.kind === "err" ? "alert" : "status"}
          className={
            message.kind === "err"
              ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              : "rounded-md border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] px-3 py-2 text-xs text-[oklch(0.80_0.14_160)]"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="submit"
          disabled={isPending || !organizationId.trim()}
        >
          {isPending
            ? "Saving…"
            : hasExisting
              ? "Update credentials"
              : "Connect Shopify"}
        </Button>
        {hasExisting ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            disabled={isPending}
          >
            Disconnect
          </Button>
        ) : null}
      </div>
    </form>
  );
}
