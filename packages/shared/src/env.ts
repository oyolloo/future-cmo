import { z } from "zod";

// Single source of truth for environment variables. Validate at load time
// so the app fails fast (build/start) when something is missing or malformed.
// Per blueprint §7: do not read process.env.X outside this module.

/**
 * When true, we're inside `next build` collecting page data — env vars
 * like DATABASE_URL may not be available yet (Dokploy/Docker only injects
 * them at runtime). We relax validation so the build succeeds, and the
 * real validation happens at first request.
 */
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: isBuildPhase
    ? z.string().optional().default("postgresql://build:build@localhost:5432/build")
    : z.url().min(1, "DATABASE_URL is required"),
  JWT_SECRET: isBuildPhase
    ? z.string().optional().default("build-placeholder-secret-32-chars-xx")
    : z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SESSION_MAX_AGE: z.coerce.number().int().positive().default(604_800),

  // Google Maps Platform — server-side key used by the GM Prospecting
  // feature for Places Text Search + Place Details. Permissive at parse
  // time (empty string treated as unset) so a bad value doesn't break the
  // whole app's module evaluation. The Maps client checks length at the
  // call site and throws an actionable error.
  GOOGLE_MAPS_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  // OpenRouter — single LLM gateway covering Anthropic / OpenAI / Google /
  // Meta / Mistral / DeepSeek etc. Used by AI-powered tools. Empty string
  // treated as unset; LLM helpers throw an actionable error at call time
  // when missing, so the absence doesn't break unrelated routes.
  OPENROUTER_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  // 32-byte symmetric key (base64) for AES-256-GCM encryption of secrets
  // at rest — currently the Shopify Partner access token. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  // Empty string treated as unset; Shopify settings page refuses to save
  // credentials without it.
  SHOPIFY_ENCRYPTION_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  // Inngest — durable background job runner. Used by GM Prospecting
  // Automation to survive Vercel function timeouts and long delays.
  // Both keys come from app.inngest.com → Manage. EVENT_KEY = send
  // events; SIGNING_KEY = verify webhooks. Missing keys are tolerated
  // so dev mode works without Inngest setup (only the automation
  // feature breaks gracefully).
  INNGEST_EVENT_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  INNGEST_SIGNING_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

export const env: Env = parseEnv();
