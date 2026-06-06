/**
 * Shared types for the GM Prospecting Automation feature.
 *
 * The actual runtime logic lives in `lib/inngest/functions.ts` and runs
 * durably via Inngest. This module exists only to hold the type
 * definitions consumed by server actions, UI components, and the CSV
 * exporter.
 */

export type AutomationTaskInput = {
  keyword: string;
  location: string;
  maxResults: number;
};

export type AutomationBusinessRow = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  googleMapsUri: string | null;
  conversionScore: number;
  conversionBand: "strong" | "moderate" | "unlikely";
  hasWebsite: boolean;
  taskKeyword: string;
  taskLocation: string;
};

export type TaskRunSummary = {
  taskIndex: number;
  status: "queued" | "running" | "done" | "failed";
  rowCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

export type DelayUnit = "minutes" | "hours" | "days";
