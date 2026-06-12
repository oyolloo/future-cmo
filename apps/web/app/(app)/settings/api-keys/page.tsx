import { requireUser } from "@/lib/auth/session";
import { listApiKeysByUser } from "@kit/database/queries";
import { ApiKeysPanel } from "./_components/api-keys-panel";

export const metadata = { title: "API Keys · FutureCMO" };

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await listApiKeysByUser(user.id);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header>
        <p className="text-label">— workspace · developer</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          API Keys
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create keys for programmatic access to FutureCMO tools. Each key is
          shown once — store it securely.
        </p>
      </header>

      <section className="mt-8">
        <ApiKeysPanel initialKeys={keys} />
      </section>
    </div>
  );
}
