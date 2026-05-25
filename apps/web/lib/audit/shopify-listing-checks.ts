/**
 * Programmatic (no-LLM) checks for a Shopify App Store listing. Each
 * category runs deterministic HTML-parsing checks and produces a 0–100
 * weighted score. Designed to mirror AppstorePulse-style audits —
 * instant, free, comparable across apps.
 */

import type { AppListingData } from "./shopify-app-listing";

// ─── Types ────────────────────────────────────────────────────────────

export type ListingCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  weight: number;
  maxWeight: number;
};

export type ListingCategory = {
  id: string;
  label: string;
  icon: string;
  score: number;
  checks: ListingCheck[];
  checkCount: number;
};

export type ListingPulse = {
  overallScore: number;
  categories: ListingCategory[];
  totalChecks: number;
};

// ─── Runner ──────────────────────────────────────────────────────────

export function runListingChecks(listing: AppListingData): ListingPulse {
  const categories = [
    buildTitleCategory(listing),
    buildDescriptionCategory(listing),
    buildVisualsCategory(listing),
    buildDiscoverabilityCategory(listing),
    buildTechnicalCategory(listing),
    buildLanguagesCategory(listing),
  ];

  const totalWeight = categories.reduce(
    (sum, c) => sum + c.checks.reduce((s, ch) => s + ch.weight, 0),
    0,
  );
  const maxWeight = categories.reduce(
    (sum, c) => sum + c.checks.reduce((s, ch) => s + ch.maxWeight, 0),
    0,
  );
  const overallScore =
    maxWeight > 0 ? Math.round((totalWeight / maxWeight) * 100) : 0;
  const totalChecks = categories.reduce((s, c) => s + c.checkCount, 0);

  return { overallScore, categories, totalChecks };
}

function categoryScore(checks: ListingCheck[]): number {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const max = checks.reduce((s, c) => s + c.maxWeight, 0);
  return max > 0 ? Math.round((total / max) * 100) : 0;
}

// ─── Title Optimization ─────────────────────────────────────────────

function buildTitleCategory(listing: AppListingData): ListingCategory {
  const checks: ListingCheck[] = [];
  const title = listing.name ?? "";

  // Length
  const len = title.length;
  if (len >= 20 && len <= 60) {
    checks.push({ id: "title-length", label: "Title length", status: "pass", detail: `${len} chars — optimal range (20–60).`, weight: 25, maxWeight: 25 });
  } else if (len > 0 && len < 20) {
    checks.push({ id: "title-length", label: "Title length", status: "warn", detail: `${len} chars — too short. Add a keyword or benefit phrase.`, weight: 10, maxWeight: 25 });
  } else if (len > 60) {
    checks.push({ id: "title-length", label: "Title length", status: "warn", detail: `${len} chars — may get truncated in search. Keep under 60.`, weight: 15, maxWeight: 25 });
  } else {
    checks.push({ id: "title-length", label: "Title length", status: "fail", detail: "No title detected.", weight: 0, maxWeight: 25 });
  }

  // Capitalization
  const words = title.split(/\s+/).filter(Boolean);
  const titleCase = words.filter((w) => /^[A-Z]/.test(w)).length;
  const titleCaseRatio = words.length > 0 ? titleCase / words.length : 0;
  if (titleCaseRatio >= 0.5) {
    checks.push({ id: "title-caps", label: "Title casing", status: "pass", detail: "Proper title case — professional look.", weight: 15, maxWeight: 15 });
  } else {
    checks.push({ id: "title-caps", label: "Title casing", status: "warn", detail: "Consider title case for all major words.", weight: 5, maxWeight: 15 });
  }

  // Special characters
  const hasSpecialChars = /[|—–·:]/.test(title);
  checks.push({
    id: "title-separator",
    label: "Uses separator/tagline",
    status: hasSpecialChars ? "pass" : "warn",
    detail: hasSpecialChars
      ? "Uses a separator to include a benefit phrase — good."
      : "Consider adding a separator (— or |) with a short benefit phrase.",
    weight: hasSpecialChars ? 10 : 0,
    maxWeight: 10,
  });

  // No keyword stuffing (rough: too many commas or repeated words)
  const commaCount = (title.match(/,/g) ?? []).length;
  checks.push({
    id: "title-stuffing",
    label: "No keyword stuffing",
    status: commaCount > 2 ? "fail" : "pass",
    detail: commaCount > 2
      ? `${commaCount} commas — looks like keyword stuffing. Keep it natural.`
      : "Title reads naturally.",
    weight: commaCount > 2 ? 0 : 10,
    maxWeight: 10,
  });

  return {
    id: "title",
    label: "Title Optimization",
    icon: "T",
    score: categoryScore(checks),
    checks,
    checkCount: checks.length,
  };
}

// ─── Description & Content ──────────────────────────────────────────

function buildDescriptionCategory(listing: AppListingData): ListingCategory {
  const checks: ListingCheck[] = [];
  const desc = listing.description;
  const wc = listing.wordCount;

  // Word count
  if (wc >= 300) {
    checks.push({ id: "desc-length", label: "Description length", status: "pass", detail: `${wc} words — comprehensive.`, weight: 15, maxWeight: 15 });
  } else if (wc >= 100) {
    checks.push({ id: "desc-length", label: "Description length", status: "warn", detail: `${wc} words — could be more detailed. Aim for 300+.`, weight: 8, maxWeight: 15 });
  } else {
    checks.push({ id: "desc-length", label: "Description length", status: "fail", detail: `Only ${wc} words — too thin. Merchants need details.`, weight: 0, maxWeight: 15 });
  }

  // Bullet points / structured formatting
  const hasBullets = /[•●✓✔▸►→–—]\s|^\s*[-*]\s/m.test(desc);
  checks.push({
    id: "desc-bullets",
    label: "Uses bullet points",
    status: hasBullets ? "pass" : "warn",
    detail: hasBullets
      ? "Structured formatting detected — scannable."
      : "No bullet points detected. Break features into scannable bullets.",
    weight: hasBullets ? 10 : 3,
    maxWeight: 10,
  });

  // Social proof mentions
  const hasSocialProof = /\b(merchants?|stores?|businesses?|customers?)\s+(use|love|trust|rely|choose)/i.test(desc) ||
    /\b\d+\+?\s+(merchants?|stores?|installs?|users?)\b/i.test(desc);
  checks.push({
    id: "desc-social-proof",
    label: "Social proof",
    status: hasSocialProof ? "pass" : "warn",
    detail: hasSocialProof
      ? "Social proof detected (merchant count, testimonials, etc.)."
      : "No social proof found. Add merchant count or testimonials.",
    weight: hasSocialProof ? 10 : 0,
    maxWeight: 10,
  });

  // CTA presence
  const hasCTA = /\b(install|try|start|get started|sign up|free trial|add app)\b/i.test(desc);
  checks.push({
    id: "desc-cta",
    label: "Call to action",
    status: hasCTA ? "pass" : "warn",
    detail: hasCTA
      ? "CTA detected in description."
      : "No clear CTA. Add 'Install now' or 'Start free trial' language.",
    weight: hasCTA ? 10 : 3,
    maxWeight: 10,
  });

  // FAQ / Q&A
  const hasFAQ = /\b(FAQ|frequently asked|questions?)\b/i.test(desc) ||
    /\?\s*\n/m.test(desc);
  checks.push({
    id: "desc-faq",
    label: "FAQ section",
    status: hasFAQ ? "pass" : "warn",
    detail: hasFAQ
      ? "FAQ/Q&A section detected."
      : "No FAQ section. Adding one addresses merchant concerns pre-install.",
    weight: hasFAQ ? 8 : 0,
    maxWeight: 8,
  });

  // Pricing mention
  const pricesMentioned = listing.pricing.length > 0;
  checks.push({
    id: "desc-pricing",
    label: "Pricing transparency",
    status: pricesMentioned ? "pass" : "warn",
    detail: pricesMentioned
      ? `${listing.pricing.length} pricing tiers detected.`
      : "No pricing detected on the listing page.",
    weight: pricesMentioned ? 8 : 2,
    maxWeight: 8,
  });

  // Benefit-first (first 200 chars should contain a benefit word)
  const firstChunk = desc.slice(0, 200).toLowerCase();
  const benefitWords = /\b(save|boost|increase|grow|automate|simplify|reduce|improve|faster|easier|more sales|more revenue)\b/;
  const leadsBenefit = benefitWords.test(firstChunk);
  checks.push({
    id: "desc-benefit-first",
    label: "Leads with benefits",
    status: leadsBenefit ? "pass" : "warn",
    detail: leadsBenefit
      ? "Opening text leads with a clear benefit."
      : "First paragraph doesn't lead with a merchant benefit. Lead with ROI, not features.",
    weight: leadsBenefit ? 10 : 3,
    maxWeight: 10,
  });

  return {
    id: "description",
    label: "Description & Content",
    icon: "📄",
    score: categoryScore(checks),
    checks,
    checkCount: checks.length,
  };
}

// ─── Visual Assets ──────────────────────────────────────────────────

function buildVisualsCategory(listing: AppListingData): ListingCategory {
  const checks: ListingCheck[] = [];
  const sc = listing.screenshotCount;

  // Screenshot count
  if (sc >= 6) {
    checks.push({ id: "vis-count", label: "Screenshot count", status: "pass", detail: `${sc} screenshots — excellent coverage.`, weight: 30, maxWeight: 30 });
  } else if (sc >= 3) {
    checks.push({ id: "vis-count", label: "Screenshot count", status: "warn", detail: `${sc} screenshots — good but aim for 6+ for best conversion.`, weight: 18, maxWeight: 30 });
  } else if (sc >= 1) {
    checks.push({ id: "vis-count", label: "Screenshot count", status: "fail", detail: `Only ${sc} screenshot(s) — merchants need to SEE the app working.`, weight: 5, maxWeight: 30 });
  } else {
    checks.push({ id: "vis-count", label: "Screenshot count", status: "fail", detail: "No screenshots detected — critical gap. Add 4–6 annotated screenshots.", weight: 0, maxWeight: 30 });
  }

  // Video (heuristic: look for common video embed indicators)
  const hasVideo = /youtube|vimeo|wistia|loom|video|demo/i.test(listing.description);
  checks.push({
    id: "vis-video",
    label: "Demo video",
    status: hasVideo ? "pass" : "warn",
    detail: hasVideo
      ? "Video/demo reference detected in listing."
      : "No demo video detected. Video boosts install rate by 20–30%.",
    weight: hasVideo ? 20 : 0,
    maxWeight: 20,
  });

  return {
    id: "visuals",
    label: "Visual Assets",
    icon: "🖼",
    score: categoryScore(checks),
    checks,
    checkCount: checks.length,
  };
}

// ─── Categories & Discoverability ───────────────────────────────────

function buildDiscoverabilityCategory(listing: AppListingData): ListingCategory {
  const checks: ListingCheck[] = [];

  // Categories listed
  const catCount = listing.categories.length;
  if (catCount >= 2) {
    checks.push({ id: "disc-cats", label: "Category count", status: "pass", detail: `Listed in ${catCount} categories: ${listing.categories.join(", ")}.`, weight: 25, maxWeight: 25 });
  } else if (catCount === 1) {
    checks.push({ id: "disc-cats", label: "Category count", status: "warn", detail: `Only 1 category (${listing.categories[0]}). Add more for wider discoverability.`, weight: 15, maxWeight: 25 });
  } else {
    checks.push({ id: "disc-cats", label: "Category count", status: "fail", detail: "No categories detected — listing may not appear in category browsing.", weight: 0, maxWeight: 25 });
  }

  // Tagline present
  const hasTagline = listing.tagline && listing.tagline.length > 10;
  checks.push({
    id: "disc-tagline",
    label: "Tagline / subtitle",
    status: hasTagline ? "pass" : "warn",
    detail: hasTagline
      ? `Tagline present (${listing.tagline!.length} chars).`
      : "No clear tagline detected. The meta description serves as the subtitle in search.",
    weight: hasTagline ? 15 : 5,
    maxWeight: 15,
  });

  // Handle is SEO-friendly (short, hyphenated, contains keywords)
  const handle = listing.handle;
  const goodHandle = handle.length > 2 && handle.length < 40 && !handle.includes("_");
  checks.push({
    id: "disc-handle",
    label: "URL handle",
    status: goodHandle ? "pass" : "warn",
    detail: goodHandle
      ? `"${handle}" — clean, keyword-friendly.`
      : `"${handle}" — consider a shorter, keyword-rich handle.`,
    weight: goodHandle ? 10 : 5,
    maxWeight: 10,
  });

  return {
    id: "discoverability",
    label: "Categories & Discoverability",
    icon: "🔍",
    score: categoryScore(checks),
    checks,
    checkCount: checks.length,
  };
}

// ─── Technical & Support ────────────────────────────────────────────

function buildTechnicalCategory(listing: AppListingData): ListingCategory {
  const checks: ListingCheck[] = [];
  const desc = listing.description;

  // Built for Shopify badge
  checks.push({
    id: "tech-bfs",
    label: "Built for Shopify badge",
    status: listing.builtForShopify ? "pass" : "fail",
    detail: listing.builtForShopify
      ? "Built for Shopify badge present — boosts trust + ranking."
      : "No 'Built for Shopify' badge. Completing Shopify's requirements earns this.",
    weight: listing.builtForShopify ? 25 : 0,
    maxWeight: 25,
  });

  // Support link
  const hasSupport = /\b(support|help center|help desk|contact us|email us)\b/i.test(desc) ||
    /support@|help@|mailto:/i.test(desc);
  checks.push({
    id: "tech-support",
    label: "Support contact",
    status: hasSupport ? "pass" : "warn",
    detail: hasSupport
      ? "Support contact/link detected."
      : "No support contact found in listing. Merchants want to know they can get help.",
    weight: hasSupport ? 15 : 3,
    maxWeight: 15,
  });

  // Documentation link
  const hasDocs = /\b(documentation|docs|guide|tutorial|knowledge base|how-to)\b/i.test(desc);
  checks.push({
    id: "tech-docs",
    label: "Documentation",
    status: hasDocs ? "pass" : "warn",
    detail: hasDocs
      ? "Documentation/guide reference detected."
      : "No documentation link found. Self-serve docs reduce support load + build trust.",
    weight: hasDocs ? 10 : 0,
    maxWeight: 10,
  });

  // Privacy policy
  const hasPrivacy = /\b(privacy policy|data protection|GDPR|CCPA)\b/i.test(desc);
  checks.push({
    id: "tech-privacy",
    label: "Privacy policy mention",
    status: hasPrivacy ? "pass" : "warn",
    detail: hasPrivacy
      ? "Privacy/data protection mentioned."
      : "No privacy policy mention. Important for merchant trust, especially in EU.",
    weight: hasPrivacy ? 10 : 3,
    maxWeight: 10,
  });

  // Changelog / updates
  const hasChangelog = /\b(changelog|what's new|recent updates|version|v\d+\.\d+)\b/i.test(desc);
  checks.push({
    id: "tech-changelog",
    label: "Changelog / updates",
    status: hasChangelog ? "pass" : "warn",
    detail: hasChangelog
      ? "Update/changelog references detected — signals active development."
      : "No changelog mentions. Active development signals build merchant confidence.",
    weight: hasChangelog ? 10 : 0,
    maxWeight: 10,
  });

  return {
    id: "technical",
    label: "Technical & Support",
    icon: "⚙",
    score: categoryScore(checks),
    checks,
    checkCount: checks.length,
  };
}

// ─── Languages ──────────────────────────────────────────────────────

function buildLanguagesCategory(listing: AppListingData): ListingCategory {
  const checks: ListingCheck[] = [];
  const desc = listing.description;

  // Multi-language support
  const langMentions = /\b(multi-?language|translation|i18n|localization|localisation|translated|supports?\s+\d+\s+languages?)\b/i.test(desc);
  const langList = desc.match(/\b(English|Spanish|French|German|Italian|Portuguese|Japanese|Chinese|Korean|Dutch|Arabic|Hindi|Turkish|Polish|Swedish|Norwegian|Danish|Finnish|Czech|Hungarian|Romanian|Thai|Vietnamese|Indonesian|Malay)\b/gi);
  const uniqueLangs = langList ? new Set(langList.map((l) => l.toLowerCase())).size : 0;

  if (langMentions || uniqueLangs >= 3) {
    checks.push({ id: "lang-multi", label: "Multi-language support", status: "pass", detail: `Multi-language support detected${uniqueLangs > 0 ? ` (${uniqueLangs} languages mentioned)` : ""}.`, weight: 30, maxWeight: 30 });
  } else if (uniqueLangs >= 1) {
    checks.push({ id: "lang-multi", label: "Multi-language support", status: "warn", detail: `Only ${uniqueLangs} language(s) mentioned. Supporting 3+ languages expands your market.`, weight: 10, maxWeight: 30 });
  } else {
    checks.push({ id: "lang-multi", label: "Multi-language support", status: "fail", detail: "No multi-language support detected. Missing 80%+ of the global Shopify market.", weight: 0, maxWeight: 30 });
  }

  // App listing translated (heuristic: look for "Available in" pattern)
  const listingTranslated = /\b(available in|listing available|translated listing)\b/i.test(desc);
  checks.push({
    id: "lang-listing",
    label: "Listing translation",
    status: listingTranslated ? "pass" : "warn",
    detail: listingTranslated
      ? "Listing appears to be available in multiple languages."
      : "Listing appears to be English-only. Translating the listing page itself boosts installs from non-English markets.",
    weight: listingTranslated ? 20 : 0,
    maxWeight: 20,
  });

  return {
    id: "languages",
    label: "Languages",
    icon: "🌐",
    score: categoryScore(checks),
    checks,
    checkCount: checks.length,
  };
}
