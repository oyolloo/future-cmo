import type { AutomationBusinessRow } from "@/lib/automation/processor";

/**
 * Every field key the user can pick in the Custom Fields repeater.
 * Matches AutomationBusinessRow keys plus the two task-level inputs.
 */
export type CustomFieldKey =
  | "taskKeyword"
  | "taskLocation"
  | "name"
  | "address"
  | "phone"
  | "website"
  | "rating"
  | "reviewCount"
  | "conversionScore"
  | "conversionBand"
  | "hasWebsite"
  | "types"
  | "googleMapsUri"
  | "placeId";

export type CustomField = {
  /** Stable React key (not persisted) */
  id: string;
  /** Column header shown in the CSV */
  label: string;
  /** Which data field to pull from each business row */
  value: CustomFieldKey | "";
};

/** Stored shape — what we persist to the DB job row */
export type CustomFieldStored = {
  label: string;
  value: CustomFieldKey;
};

/** Options for the Value dropdown. Order = recommended priority. */
export const FIELD_OPTIONS: Array<{ value: CustomFieldKey; label: string }> = [
  { value: "name", label: "Business Name" },
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "rating", label: "Rating" },
  { value: "reviewCount", label: "Review Count" },
  { value: "conversionScore", label: "Conversion Score" },
  { value: "conversionBand", label: "Conversion Band" },
  { value: "hasWebsite", label: "Has Website" },
  { value: "types", label: "Categories" },
  { value: "googleMapsUri", label: "Google Maps URL" },
  { value: "placeId", label: "Place ID" },
  { value: "taskKeyword", label: "Search Keyword" },
  { value: "taskLocation", label: "Search Location" },
];

/** Quick label lookup keyed by CustomFieldKey */
export const FIELD_LABEL_LOOKUP: Record<CustomFieldKey, string> =
  Object.fromEntries(FIELD_OPTIONS.map((o) => [o.value, o.label])) as Record<
    CustomFieldKey,
    string
  >;

/** Pull a value out of a business row, formatting for CSV. */
export function readFieldValue(
  row: AutomationBusinessRow,
  key: CustomFieldKey,
): unknown {
  return row[key];
}
