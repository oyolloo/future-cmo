import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

/**
 * Inngest webhook handler.
 *
 * Inngest calls this endpoint to:
 *  1. Discover registered functions (PUT request)
 *  2. Invoke a function step (POST request)
 *  3. Health check (GET request)
 *
 * The signing key from env.INNGEST_SIGNING_KEY is used to verify each
 * request is genuinely from Inngest. Without it, Inngest refuses to
 * deliver events to your endpoint in production.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
