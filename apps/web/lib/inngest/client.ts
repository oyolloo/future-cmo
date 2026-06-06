import "server-only";

import { Inngest } from "inngest";

import { env } from "@kit/shared/env";

/**
 * Single Inngest client instance. Used by:
 *  - Server actions to send events
 *  - The /api/inngest webhook to register functions
 *
 * When INNGEST_EVENT_KEY is missing (dev without setup), the client still
 * constructs but `inngest.send()` will throw — which is the correct
 * failure mode for a feature that fundamentally needs Inngest.
 */
export const inngest = new Inngest({
  id: "future-cmo",
  eventKey: env.INNGEST_EVENT_KEY,
});

// ─── Event type registry ────────────────────────────────────────────

export type InngestEvents = {
  "automation/job.queued": {
    data: {
      jobId: string;
      userId: string;
    };
  };
};
