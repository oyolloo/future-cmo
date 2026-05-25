// AI crawler constants + types shared between the robots-parser
// (server-only) and the AI SEO results UI (client). No imports — pure
// data so it can cross the server/client boundary.

export type BotAccess = "allow" | "disallow" | "no-rule";

export const AI_BOTS = [
  "GPTBot", // OpenAI training crawler
  "ChatGPT-User", // OpenAI live browsing
  "OAI-SearchBot", // OpenAI SearchGPT
  "ClaudeBot", // Anthropic training crawler
  "Claude-Web", // Anthropic live browsing
  "anthropic-ai", // legacy Anthropic ID
  "PerplexityBot", // Perplexity citation crawler
  "Perplexity-User", // Perplexity live browse
  "Google-Extended", // Gemini training opt-out
  "Bytespider", // ByteDance / Doubao
  "CCBot", // Common Crawl (used by many models)
  "Applebot-Extended", // Apple Intelligence
] as const;

export type AIBot = (typeof AI_BOTS)[number];

export type RobotsReport = Record<AIBot, BotAccess>;
