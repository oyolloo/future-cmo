import Link from "next/link";

import { findShopifyPartnerCredentials } from "@kit/database";

import { requireUser } from "@/lib/auth/session";

import { CredentialsForm } from "./_components/credentials-form";

export const metadata = {
  title: "Shopify settings · future-cmo",
};

export default async function ShopifySettingsPage() {
  const user = await requireUser();
  const creds = await findShopifyPartnerCredentials(user.id);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href="/shopify"
        className="text-comment hover:text-foreground"
      >
        ← back to Shopify apps
      </Link>

      <header className="mt-6">
        <p className="text-label">— shopify · partner api credentials</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Connect your Partner account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Partner API gives us install / uninstall events + store info for
          your apps. Credentials are AES-256-GCM encrypted at rest and only
          decrypted inside server-side sync calls.
        </p>
      </header>

      <section className="mt-8">
        <CredentialsForm
          hasExisting={Boolean(creds)}
          existingOrgId={creds?.organizationId ?? null}
        />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <p className="text-label">Quick setup</p>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-mono text-foreground">1.</span> Partner
            Dashboard → Settings → Partner API clients → <strong>Create
            client</strong>
          </li>
          <li>
            <span className="font-mono text-foreground">2.</span> Grant the{" "}
            <strong>Manage apps</strong> permission (other perms not needed)
          </li>
          <li>
            <span className="font-mono text-foreground">3.</span> Copy the
            generated access token and your numeric{" "}
            <strong>Organization ID</strong> from the URL
          </li>
          <li>
            <span className="font-mono text-foreground">4.</span> Paste both
            above. We&apos;ll probe the token with a trivial query before
            saving.
          </li>
        </ol>
      </section>
    </div>
  );
}
