"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import {
  deleteEmailSettingsAction,
  saveEmailSettingsAction,
  testEmailAction,
} from "../_lib/actions";

type Provider = "resend" | "brevo";

type Props = {
  appGid: string;
  existing: {
    provider: string;
    fromEmail: string;
    fromName: string;
  } | null;
};

export function EmailSettingsTab({ appGid, existing }: Props) {
  return (
    <div className="space-y-3">
      <SettingsSection
        title="Email provider"
        hint="configure how this app sends emails to merchants"
        status={
          existing
            ? `${existing.provider} · ${existing.fromEmail}`
            : "Not configured"
        }
        statusOk={!!existing}
        defaultOpen={!existing}
      >
        <EmailProviderForm appGid={appGid} existing={existing} />
      </SettingsSection>

      {/* Future settings sections go here */}
    </div>
  );
}

// ─── Collapsible section ─────────────────────────────────────────────

function SettingsSection({
  title,
  hint,
  status,
  statusOk,
  defaultOpen,
  children,
}: {
  title: string;
  hint: string;
  status: string;
  statusOk: boolean;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "size-2 rounded-full",
              statusOk ? "bg-[oklch(0.72_0.14_160)]" : "bg-muted-foreground/30",
            )}
          />
          <div className="text-left">
            <p className="text-label">{title}</p>
            <p className="mt-0.5 font-mono text-[0.625rem] text-muted-foreground">
              {status}
            </p>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <p className="text-comment mb-4">{`// ${hint}`}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ─── Email form ──────────────────────────────────────────────────────

function EmailProviderForm({
  appGid,
  existing,
}: {
  appGid: string;
  existing: Props["existing"];
}) {
  const [provider, setProvider] = useState<Provider>(
    (existing?.provider as Provider) ?? "resend",
  );
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(existing?.fromEmail ?? "");
  const [fromName, setFromName] = useState(existing?.fromName ?? "");

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const onSave = () => {
    setFeedback(null);
    startTransition(async () => {
      const keyToSave = apiKey.trim();
      if (!existing && !keyToSave) {
        setFeedback({ type: "err", msg: "API key is required." });
        return;
      }
      if (!keyToSave && existing) {
        setFeedback({ type: "err", msg: "Enter the API key to update." });
        return;
      }
      const res = await saveEmailSettingsAction({
        appGid,
        provider,
        apiKey: keyToSave,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
      });
      if (res.ok) {
        setFeedback({ type: "ok", msg: "Email settings saved." });
        setApiKey("");
      } else {
        setFeedback({ type: "err", msg: res.error.message });
      }
    });
  };

  const onTest = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await testEmailAction(appGid);
      if (res.ok) {
        setFeedback({ type: "ok", msg: `Test email sent to ${fromEmail}` });
      } else {
        setFeedback({ type: "err", msg: res.error.message });
      }
    });
  };

  const onDelete = () => {
    if (!confirm("Remove email configuration?")) return;
    setFeedback(null);
    startTransition(async () => {
      await deleteEmailSettingsAction(appGid);
      setApiKey("");
      setFromEmail("");
      setFromName("");
      setFeedback({ type: "ok", msg: "Email config removed." });
    });
  };

  return (
    <div className="space-y-4">
      {/* Provider */}
      <div>
        <p className="text-xs text-muted-foreground">PROVIDER</p>
        <div className="mt-1.5 flex gap-2">
          {(["resend", "brevo"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                provider === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Fields — 2 col on larger screens */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">API KEY</p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={existing ? "••••••• (enter new key to update)" : "re_xxxxx..."}
            disabled={isPending}
            className="mt-1.5"
          />
          <p className="text-comment mt-1">
            {provider === "resend"
              ? "// resend.com → API Keys → Create"
              : "// app.brevo.com → SMTP & API → API Keys"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">FROM EMAIL</p>
          <Input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="support@yourapp.com"
            disabled={isPending}
            className="mt-1.5"
          />
          <p className="text-comment mt-1">
            {"// must be verified in your provider's dashboard"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">FROM NAME</p>
          <Input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Table Pilot Support"
            disabled={isPending}
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Feedback */}
      {feedback ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            feedback.type === "ok"
              ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {feedback.msg}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : existing ? "Update" : "Save"}
        </Button>
        {existing ? (
          <>
            <Button variant="outline" onClick={onTest} disabled={isPending}>
              {isPending ? "…" : "Send test email"}
            </Button>
            <Button variant="ghost" onClick={onDelete} disabled={isPending} className="text-destructive">
              Remove
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
