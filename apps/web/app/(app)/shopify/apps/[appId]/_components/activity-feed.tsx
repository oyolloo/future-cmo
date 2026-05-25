"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import { DataTable } from "@/components/ui/data-table";

import { generateChurnEmailAction, sendAppEmailAction } from "../_lib/actions";

type EventRow = {
  id: string;
  eventType: string;
  shopName: string | null;
  shopDomain: string | null;
  shopEmail: string | null;
  ownerName: string | null;
  occurredAt: string;
};

const CHURN_EVENTS = new Set([
  "RelationshipUninstalled",
  "RelationshipDeactivated",
  "SubscriptionChargeCanceled",
]);

function buildColumns(appName: string, appGid: string, emailConfigured: boolean): ColumnDef<EventRow>[] {
  return [
    {
      id: "event",
      header: "Event",
      accessorKey: "eventType",
      size: 200,
      cell: ({ row }) => {
        const isInstall =
          row.original.eventType === "RelationshipInstalled" ||
          row.original.eventType === "RelationshipReactivated";
        return (
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem]",
                isInstall
                  ? "bg-[oklch(0.72_0.14_160/20%)] text-[oklch(0.80_0.14_160)]"
                  : "bg-destructive/20 text-destructive",
              )}
              aria-hidden
            >
              {isInstall ? "+" : "−"}
            </span>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">
              {eventLabel(row.original.eventType)}
            </span>
          </div>
        );
      },
    },
    {
      id: "store",
      header: "Store",
      accessorFn: (r) => r.shopName ?? r.shopDomain ?? "",
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="text-sm text-foreground">
            {row.original.shopName ?? "(unnamed)"}
          </span>
          {row.original.shopDomain ? (
            <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
              {row.original.shopDomain}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "time",
      header: "When",
      accessorKey: "occurredAt",
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {formatRelative(row.original.occurredAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      size: 100,
      meta: { align: "right" },
      cell: ({ row }) => {
        const evt = row.original;
        if (!CHURN_EVENTS.has(evt.eventType)) return null;
        return <ChurnEmailAction event={evt} appName={appName} appGid={appGid} emailConfigured={emailConfigured} />;
      },
    },
  ];
}

export function ActivityFeed({
  events,
  appGid,
  appName,
  emailConfigured,
}: {
  events: EventRow[];
  appGid: string;
  appName: string;
  emailConfigured: boolean;
}) {
  const columns = buildColumns(appName, appGid, emailConfigured);
  return (
    <DataTable
      columns={columns}
      data={events}
      getRowId={(r) => r.id}
      pageSize={10}
      pageSizeOptions={[10, 25, 50]}
      emptyMessage="No events yet — run sync to populate."
    />
  );
}

// ─── Churn email action ─────────────────────────────────────────────

function ChurnEmailAction({
  event,
  appName,
  appGid,
  emailConfigured,
}: {
  event: EventRow;
  appName: string;
  appGid: string;
  emailConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailBody, setEmailBody] = useState("");
  const [subject, setSubject] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const storeName = event.shopName ?? event.shopDomain ?? "your store";

  const openDialog = (type: "ask-why" | "win-back") => {
    setMenuOpen(false);
    setOpen(true);
    setError(null);
    setSendResult(null);

    setSubject(
      type === "ask-why"
        ? `Quick question about ${appName}`
        : `We'd love to have you back on ${appName}`,
    );

    startTransition(async () => {
      const res = await generateChurnEmailAction({
        appName,
        shopName: storeName,
        shopDomain: event.shopDomain,
        eventType: event.eventType,
        ownerName: event.ownerName,
      });
      if (res.ok) {
        setEmailBody(res.data.body);
      } else {
        setError(res.error.message);
        setEmailBody(
          `Hi ${event.ownerName?.split(" ")[0] ?? "there"},\n\nI noticed you recently left ${appName}. I just wanted to reach out and ask — was there something we could have done better?\n\nYour feedback would really help us improve.\n\nBest regards`,
        );
      }
    });
  };

  const onSend = () => {
    if (!event.shopEmail || !emailBody) return;
    setSendResult(null);

    if (emailConfigured) {
      startSendTransition(async () => {
        const res = await sendAppEmailAction({
          appGid,
          to: event.shopEmail!,
          subject,
          body: emailBody,
        });
        if (res.ok) {
          setSendResult({ type: "ok", msg: `Sent to ${event.shopEmail}` });
          setTimeout(() => setOpen(false), 1500);
        } else {
          setSendResult({ type: "err", msg: res.error.message });
        }
      });
    } else {
      const mailto = `mailto:${encodeURIComponent(event.shopEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailto, "_blank");
      setOpen(false);
    }
  };

  return (
    <>
      {/* Dropdown trigger */}
      <div className="relative" data-row-action>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="font-mono text-[0.625rem]"
        >
          ···
        </Button>

        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-xl">
              <button
                type="button"
                onClick={() => openDialog("ask-why")}
                className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted/50"
              >
                Ask why they left
              </button>
              <button
                type="button"
                onClick={() => openDialog("win-back")}
                className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted/50"
              >
                Win-back email
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Email compose dialog */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-label">
                Email · {storeName}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* To */}
              <div>
                <p className="text-[0.625rem] text-muted-foreground">TO</p>
                {event.shopEmail ? (
                  <p className="mt-1 font-mono text-xs text-foreground">
                    {event.shopEmail}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-destructive">
                    No email on file — add one in the Stores tab first
                  </p>
                )}
              </div>

              {/* Subject */}
              <div>
                <p className="text-[0.625rem] text-muted-foreground">SUBJECT</p>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[0.625rem] text-muted-foreground">MESSAGE</p>
                  {isPending ? (
                    <span className="flex items-center gap-1.5 text-[0.625rem] text-primary">
                      <span className="inline-block size-3 animate-spin rounded-full border border-primary border-t-transparent" />
                      AI writing…
                    </span>
                  ) : null}
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  disabled={isPending}
                  placeholder={isPending ? "Generating personalized email…" : "Email body"}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              {error ? (
                <p className="text-[0.6875rem] text-[oklch(0.85_0.14_90)]">
                  AI fallback used: {error}
                </p>
              ) : null}

              {sendResult ? (
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs",
                    sendResult.type === "ok"
                      ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {sendResult.msg}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-comment">
                  {emailConfigured
                    ? "// sends via configured provider"
                    : "// opens your email client (configure in Settings for direct send)"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={isPending || isSending || !emailBody || !event.shopEmail}
                    onClick={onSend}
                  >
                    {isSending ? "Sending…" : "Send email"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function eventLabel(type: string): string {
  switch (type) {
    case "RelationshipInstalled":
      return "installed";
    case "RelationshipUninstalled":
      return "uninstalled";
    case "RelationshipReactivated":
      return "reactivated";
    case "RelationshipDeactivated":
      return "deactivated";
    case "SubscriptionChargeAccepted":
      return "subscription accepted";
    case "SubscriptionChargeActivated":
      return "subscription activated";
    case "SubscriptionChargeCanceled":
      return "subscription canceled";
    case "SubscriptionChargeFrozen":
      return "subscription frozen";
    case "SubscriptionChargeExpired":
      return "subscription expired";
    case "OneTimeChargeAccepted":
      return "one-time accepted";
    case "OneTimeChargeActivated":
      return "one-time activated";
    case "OneTimeChargeExpired":
      return "one-time expired";
    case "UsageChargeApplied":
      return "usage charge";
    case "CreditApplied":
      return "credit applied";
    default:
      return type.replace("Relationship", "").toLowerCase();
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toISOString().slice(0, 10);
}
