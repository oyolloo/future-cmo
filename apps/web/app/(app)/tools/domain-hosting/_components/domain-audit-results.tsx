"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type {
  DnsRecords,
  EmailSecurity,
} from "@/lib/audit/dns-lookup";
import type { IpGeo } from "@/lib/audit/ip-geo";
import type { RdapDomainInfo } from "@/lib/audit/rdap";

import type { DomainAuditData } from "../_lib/actions";

export function DomainAuditResults({ data }: { data: DomainAuditData }) {
  return (
    <div className="space-y-6">
      <DomainCard
        domain={data.domain}
        rdap={data.rdap}
        rdapError={data.rdapError}
        daysToExpiry={data.daysToExpiry}
      />

      <HostingCard
        geo={data.geo}
        geoError={data.geoError}
        primaryIp={data.dns.a[0] ?? null}
      />

      <NameserversCard
        rdapNs={data.rdap?.nameservers ?? []}
        dnsNs={data.dns.ns}
        dnssec={data.rdap?.dnssecEnabled ?? null}
      />

      <EmailSecurityCard email={data.email} />

      <DnsRecordsCard dns={data.dns} />

      <p className="text-comment">
        {`// audit ran in ${(data.durationMs / 1000).toFixed(2)}s · RDAP + DNS (Cloudflare 1.1.1.1) + ipapi.co`}
      </p>
    </div>
  );
}

// ─── Domain card ─────────────────────────────────────────────────────

function DomainCard({
  domain,
  rdap,
  rdapError,
  daysToExpiry,
}: {
  domain: string;
  rdap: RdapDomainInfo | null;
  rdapError: string | null;
  daysToExpiry: number | null;
}) {
  const registration = rdap?.events.find((e) => e.action === "registration");
  const expiration = rdap?.events.find((e) => e.action === "expiration");
  const lastChanged = rdap?.events.find((e) => e.action === "last changed");

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-label">Domain</p>
          <h2 className="mt-1 font-mono text-lg text-foreground">{domain}</h2>
        </div>
        {daysToExpiry != null ? <ExpiryPill days={daysToExpiry} /> : null}
      </header>

      {rdap ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Registrar"
            value={rdap.registrar?.name ?? "—"}
            mono={false}
          />
          <Field
            label="Registered"
            value={formatDate(registration?.date)}
          />
          <Field label="Expires" value={formatDate(expiration?.date)} />
          <Field
            label="Last updated"
            value={formatDate(lastChanged?.date)}
          />
          <Field
            label="DNSSEC"
            value={rdap.dnssecEnabled ? "signed" : "not signed"}
          />
          <Field
            label="Status"
            value={
              rdap.status.length > 0 ? rdap.status.join(" · ") : "—"
            }
            mono={false}
          />
        </dl>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">
            {rdapError ?? "Registrar info unavailable."}
          </p>
        </div>
      )}
    </section>
  );
}

function ExpiryPill({ days }: { days: number }) {
  let tone: "ok" | "warn" | "fail";
  let label: string;
  if (days < 0) {
    tone = "fail";
    label = `expired ${-days}d ago`;
  } else if (days < 30) {
    tone = "fail";
    label = `expires in ${days}d`;
  } else if (days < 90) {
    tone = "warn";
    label = `expires in ${days}d`;
  } else {
    tone = "ok";
    label = `expires in ${days}d`;
  }
  const styles: Record<typeof tone, string> = {
    ok: "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    warn: "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    fail: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider",
        styles[tone],
      )}
    >
      {label}
    </span>
  );
}

// ─── Hosting card ────────────────────────────────────────────────────

function HostingCard({
  geo,
  geoError,
  primaryIp,
}: {
  geo: IpGeo | null;
  geoError: string | null;
  primaryIp: string | null;
}) {
  if (!primaryIp) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-label">Hosting</p>
        <p className="mt-3 text-sm text-muted-foreground">
          No A record — domain doesn&apos;t resolve to a server.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">Hosting</p>
      {geo ? (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="IP address" value={geo.ip} />
          <Field
            label="Hosting provider"
            value={geo.org ?? geo.asnOrg ?? "—"}
            mono={false}
          />
          <Field label="ASN" value={geo.asn ?? "—"} />
          <Field
            label="Location"
            value={
              [geo.city, geo.region, geo.country].filter(Boolean).join(", ") ||
              "—"
            }
            mono={false}
          />
          <Field
            label="Country code"
            value={geo.countryCode ?? "—"}
          />
          <Field
            label="Reverse DNS"
            value={geo.hostname ?? "—"}
          />
        </dl>
      ) : (
        <div className="mt-4 space-y-2">
          <Field label="IP address" value={primaryIp} />
          <p className="text-xs text-muted-foreground">
            {geoError ?? "Geo info unavailable."}
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Nameservers card ───────────────────────────────────────────────

function NameserversCard({
  rdapNs,
  dnsNs,
  dnssec,
}: {
  rdapNs: string[];
  dnsNs: string[];
  dnssec: boolean | null;
}) {
  // Merge unique. Registry NS (rdapNs) is authoritative; DNS NS may
  // include additional glue. We dedupe and prefer registry order.
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const n of [...rdapNs, ...dnsNs]) {
    const k = n.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(k);
    }
  }

  if (merged.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label">Nameservers · {merged.length}</p>
        {dnssec != null ? (
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
              dnssec
                ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            DNSSEC {dnssec ? "signed" : "off"}
          </span>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5">
        {merged.map((ns) => (
          <li
            key={ns}
            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
          >
            {ns}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Email security ─────────────────────────────────────────────────

function EmailSecurityCard({ email }: { email: EmailSecurity }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">Email security</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <EmailSignal
          label="MX records"
          status={email.hasMx ? "pass" : "fail"}
          detail={
            email.hasMx
              ? `${email.mxCount} mail server${email.mxCount === 1 ? "" : "s"} configured`
              : "No MX records — domain cannot receive email."
          }
        />
        <EmailSignal
          label="SPF"
          status={email.hasSpf ? "pass" : "fail"}
          detail={
            email.spfPolicy
              ? email.spfPolicy
              : "No SPF record — any server can spoof emails from this domain."
          }
        />
        <EmailSignal
          label="DMARC"
          status={
            email.dmarcEnforcement === "reject"
              ? "pass"
              : email.dmarcEnforcement === "quarantine"
                ? "warn"
                : email.hasDmarc
                  ? "warn"
                  : "fail"
          }
          detail={
            email.dmarcPolicy
              ? `Policy: ${email.dmarcEnforcement ?? "unspecified"} — ${email.dmarcPolicy}`
              : "No DMARC record — spoofing is undetectable + unreported."
          }
        />
      </div>
    </section>
  );
}

function EmailSignal({
  label,
  status,
  detail,
}: {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}) {
  const styles: Record<typeof status, string> = {
    pass: "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)]",
    warn: "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)]",
    fail: "border-destructive/30 bg-destructive/10",
  };
  const glyph: Record<typeof status, string> = {
    pass: "✓",
    warn: "■",
    fail: "▲",
  };
  return (
    <div className={cn("rounded-md border p-3", styles[status])}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-foreground">
          {label}
        </span>
        <span aria-hidden className="font-mono text-xs">
          {glyph[status]}
        </span>
      </div>
      <p className="mt-2 break-all font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

// ─── DNS records table ─────────────────────────────────────────────

function DnsRecordsCard({ dns }: { dns: DnsRecords }) {
  const [open, setOpen] = useState(true);
  const rows: Array<{ type: string; values: string[] }> = [
    { type: "A", values: dns.a },
    { type: "AAAA", values: dns.aaaa },
    {
      type: "MX",
      values: dns.mx.map((mx) => `${mx.priority} ${mx.exchange}`),
    },
    { type: "NS", values: dns.ns },
    { type: "CNAME", values: dns.cname },
    { type: "TXT", values: dns.txt },
  ].filter((r) => r.values.length > 0);

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.values.length, 0);

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="text-label">
          DNS records · {total} total ({rows.length} types)
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          {open ? "hide" : "show"}
        </span>
      </button>
      {open ? (
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-background">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-16 px-3 py-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="px-3 py-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row) =>
                row.values.map((v, i) => (
                  <tr
                    key={`${row.type}-${i}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2 align-top font-mono text-[0.6875rem] text-muted-foreground">
                      {i === 0 ? row.type : ""}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[0.6875rem] text-foreground break-all">
                      {v}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

// ─── Field helper ───────────────────────────────────────────────────

function Field({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}
