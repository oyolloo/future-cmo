import { z } from "zod";

// Single source of truth for environment variables. Validate at load time
// so the app fails fast (build/start) when something is missing or malformed.
// Per blueprint §7: do not read process.env.X outside this module.

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
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
