import { NextResponse, type NextRequest } from "next/server";
import { withApiKey } from "@/lib/api/middleware";
import { lookupRdap } from "@/lib/audit/rdap";
import { lookupDns, lookupEmailSecurity } from "@/lib/audit/dns-lookup";
import { lookupIpGeo } from "@/lib/audit/ip-geo";

export async function POST(req: NextRequest) {
  return withApiKey(req, "domain-info", async () => {
    const body = await req.json().catch(() => null);
    const rawUrl = body?.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'url' field" } },
        { status: 400 },
      );
    }

    let domain: string;
    try {
      const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
      domain = u.hostname.replace(/^www\./, "");
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Invalid URL" } },
        { status: 400 },
      );
    }

    const [rdapResult, dnsRecords] = await Promise.all([
      lookupRdap(domain).catch(() => ({ ok: false as const, error: { kind: "network" as const, message: "" } })),
      lookupDns(domain).catch(() => ({ a: [], aaaa: [], mx: [], ns: [], txt: [], cname: [] })),
    ]);

    const email = await lookupEmailSecurity(domain, dnsRecords.txt, dnsRecords.mx).catch(() => ({
      hasMx: false,
      mxCount: 0,
      hasSpf: false,
      spfPolicy: null,
      hasDmarc: false,
      dmarcPolicy: null,
      dmarcEnforcement: null,
    }));

    const primaryIp = dnsRecords.a[0] ?? null;
    let hosting = null;
    if (primaryIp) {
      const geo = await lookupIpGeo(primaryIp).catch(() => null);
      if (geo?.ok) hosting = geo.data;
    }

    const rdap = rdapResult.ok ? rdapResult.data : null;
    const expiry = rdap?.events.find((e) => e.action === "expiration");
    const daysToExpiry = expiry
      ? Math.floor((new Date(expiry.date).getTime() - Date.now()) / 86_400_000)
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        daysToExpiry,
        dns: dnsRecords,
        email: { hasSpf: email.hasSpf, hasDmarc: email.hasDmarc },
        registrar: rdap?.registrar ?? null,
        hosting,
      },
    });
  });
}
