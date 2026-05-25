"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRef, useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import { DataTable } from "@/components/ui/data-table";

import { updateStoreCrmAction } from "../_lib/actions";

export type StoreRow = {
  appGid: string;
  shopGid: string;
  shopName: string | null;
  shopDomain: string | null;
  currentState: string;
  firstInstalledAt: string | null;
  lastEventAt: string;
  email: string | null;
  ownerName: string | null;
  phone: string | null;
  notes: string | null;
  country: string | null;
  revenue: number;
  revenueCurrency: string;
};

function buildColumns(appGid: string, appName: string): ColumnDef<StoreRow>[] {
  return [
    {
      id: "name",
      header: "Store",
      accessorFn: (r) => r.shopName ?? r.shopDomain ?? r.shopGid,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.original.shopName ?? "(no name)"}
          </p>
          {row.original.shopDomain ? (
            <a
              href={`https://${row.original.shopDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-[0.6875rem] text-primary hover:underline"
              data-row-action
            >
              {row.original.shopDomain}
            </a>
          ) : null}
        </div>
      ),
    },
    {
      id: "state",
      header: "State",
      accessorKey: "currentState",
      size: 80,
      cell: ({ row }) => <StatePill state={row.original.currentState} />,
    },
    {
      id: "revenue",
      header: "Revenue",
      accessorKey: "revenue",
      size: 100,
      cell: ({ row }) => {
        const r = row.original;
        return r.revenue > 0 ? (
          <span className="font-mono text-xs text-[oklch(0.80_0.14_160)]">
            {r.revenueCurrency} {r.revenue.toFixed(2)}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground/50">—</span>
        );
      },
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      size: 180,
      cell: ({ row }) => (
        <EditableCell
          appGid={appGid}
          shopGid={row.original.shopGid}
          field="email"
          value={row.original.email}
          placeholder="add email"
          type="email"
        />
      ),
    },
    {
      id: "owner",
      header: "Owner",
      accessorKey: "ownerName",
      size: 140,
      cell: ({ row }) => (
        <EditableCell
          appGid={appGid}
          shopGid={row.original.shopGid}
          field="ownerName"
          value={row.original.ownerName}
          placeholder="add name"
        />
      ),
    },
    {
      id: "country",
      header: "Country",
      accessorKey: "country",
      size: 100,
      cell: ({ row }) => (
        <EditableCell
          appGid={appGid}
          shopGid={row.original.shopGid}
          field="country"
          value={row.original.country}
          placeholder="add country"
        />
      ),
    },
    {
      id: "notes",
      header: "Notes",
      accessorKey: "notes",
      size: 160,
      cell: ({ row }) => (
        <EditableCell
          appGid={appGid}
          shopGid={row.original.shopGid}
          field="notes"
          value={row.original.notes}
          placeholder="add notes"
        />
      ),
    },
    {
      id: "firstInstalled",
      header: "Installed",
      accessorFn: (r) => r.firstInstalledAt ?? "",
      size: 100,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.firstInstalledAt
            ? formatDate(row.original.firstInstalledAt)
            : "—"}
        </span>
      ),
    },
    {
      id: "lastEvent",
      header: "Last event",
      accessorFn: (r) => r.lastEventAt,
      size: 100,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatRelative(row.original.lastEventAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      size: 80,
      meta: { align: "right" },
      cell: ({ row }) => (
        <EmailAction store={row.original} appName={appName} />
      ),
    },
  ];
}

export function StoresTable({
  rows,
  appGid,
  appName,
}: {
  rows: StoreRow[];
  appGid: string;
  appName: string;
}) {
  const columns = buildColumns(appGid, appName);
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.shopGid}
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyMessage="No stores yet — run sync to populate."
    />
  );
}

// ─── Inline editable cell ──────────────────────────────────────────

function EditableCell({
  appGid,
  shopGid,
  field,
  value,
  placeholder,
  type = "text",
}: {
  appGid: string;
  shopGid: string;
  field: "email" | "ownerName" | "phone" | "notes" | "country";
  value: string | null;
  placeholder: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    setEditing(false);
    if (draft.trim() === (value ?? "").trim()) return; // no change
    startTransition(async () => {
      await updateStoreCrmAction({
        appGid,
        shopGid,
        field,
        value: draft,
      });
    });
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        autoFocus
        data-row-action
        className="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground outline-none focus:ring-1 focus:ring-primary/50"
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      disabled={isPending}
      data-row-action
      className={cn(
        "w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-[0.6875rem] transition-colors hover:bg-muted/40",
        value
          ? "text-foreground"
          : "text-muted-foreground/50 italic",
      )}
      title="Click to edit"
    >
      {isPending ? "saving…" : value || placeholder}
    </button>
  );
}

// ─── Email action ─────────────────────────────────────────────────

function EmailAction({ store, appName }: { store: StoreRow; appName: string }) {
  const [open, setOpen] = useState(false);

  const ownerFirst = store.ownerName?.split(" ")[0] ?? "there";
  const storeName = store.shopName ?? store.shopDomain ?? "your store";

  const defaultSubject = store.currentState === "inactive"
    ? `We'd love your feedback on ${appName}`
    : `Quick question about ${appName} on ${storeName}`;

  const defaultBody = store.currentState === "inactive"
    ? `Hi ${ownerFirst},\n\nI noticed you recently uninstalled ${appName} from ${storeName}. I completely understand — I just wanted to reach out personally to ask:\n\n1. Was there a specific issue or missing feature that led to the uninstall?\n2. Is there anything we could improve that would make ${appName} worth trying again?\n\nYour honest feedback means a lot to us, and if there's a bug or missing feature we can address, I'd love to fix it for you.\n\nBest regards`
    : `Hi ${ownerFirst},\n\nThanks for using ${appName} on ${storeName}! I wanted to check in and see how things are going.\n\nIs there anything we can help with or any features you'd like to see?\n\nBest regards`;

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  if (!store.email && !open) {
    return (
      <span
        className="font-mono text-[0.625rem] text-muted-foreground/40"
        title="Add an email first to send messages"
      >
        no email
      </span>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        data-row-action
        className="font-mono text-[0.625rem]"
      >
        Email
      </Button>
    );
  }

  const mailto = `mailto:${encodeURIComponent(store.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
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
            Send email · {store.shopName ?? store.shopDomain}
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
          <div>
            <p className="text-[0.625rem] text-muted-foreground">TO</p>
            <p className="mt-1 font-mono text-xs text-foreground">{store.email}</p>
          </div>

          <div>
            <p className="text-[0.625rem] text-muted-foreground">SUBJECT</p>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <p className="text-[0.625rem] text-muted-foreground">MESSAGE</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-comment">{"// opens your email client"}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <a href={mailto} onClick={() => setOpen(false)}>
                <Button size="sm">
                  Send email
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const styles: Record<string, string> = {
    active:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    inactive: "border-destructive/30 bg-destructive/10 text-destructive",
    unknown: "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
        styles[state] ?? styles.unknown,
      )}
    >
      {state}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
