import { z } from "zod";

export const RADIUS_OPTIONS = [1, 2, 5, 10, 15, 25, 50, 100] as const;

/** Google Places API (New) Text Search caps `maxResultCount` at 20 per call.
 *  For totals above 20, the server chains `nextPageToken` requests (each
 *  page is a separate billed API call with a ~1.5s mandatory delay). */
export const LIMIT_OPTIONS = [20, 40, 60, 80, 100] as const;

const KM_TO_MI = 0.621371;

export function formatRadius(km: number): string {
  const mi = (km * KM_TO_MI).toFixed(1);
  return `${km} km (${mi} mi)`;
}

export const searchSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters")
    .max(80, "Keyword too long"),
  location: z
    .string()
    .trim()
    .min(2, "Location is required")
    .max(120, "Location too long"),
  radiusKm: z.coerce
    .number()
    .refine((v) => (RADIUS_OPTIONS as readonly number[]).includes(v), {
      message: "Pick a valid radius",
    }),
  maxResults: z.coerce
    .number()
    .refine((v) => (LIMIT_OPTIONS as readonly number[]).includes(v), {
      message: "Pick a valid result limit",
    })
    .default(20),
});

export type SearchInput = z.infer<typeof searchSchema>;
