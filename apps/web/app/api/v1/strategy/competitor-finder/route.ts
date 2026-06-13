import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";

export function OPTIONS() { return handleCorsPreFlight(); }
import { chatJson, FREE_MODELS, CHEAP_MODELS } from "@/lib/ai/openrouter";

const CompetitorSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      reason: z.string().optional(),
    }),
  ).max(10),
});

export async function POST(req: NextRequest) {
  return withApiKey(req, "competitor-finder", async () => {
    const body = await req.json().catch(() => null);
    const { productName, productType, description } = body ?? {};
    if (!productName || typeof productName !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'productName' field" } },
        { status: 400 },
      );
    }

    const prompt = `Find up to 10 online competitors for this business:
- Business name: ${productName}
- Type/Category: ${productType || "unknown"}
- Description: ${description || "N/A"}

Return JSON: { "competitors": [{ "name": "Company Name", "url": "https://example.com", "reason": "brief reason" }] }

Rules:
- Only include real, currently-operating businesses with working websites
- URLs must be full homepage URLs (https://...)
- If you cannot find competitors, return { "competitors": [] }
- Prioritise direct competitors in the same category and market`;

    const result = await chatJson(
      [{ role: "user", content: prompt }],
      CompetitorSchema,
      { models: [...FREE_MODELS, ...CHEAP_MODELS], temperature: 0.3, maxTokens: 1200 },
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "TOOL_ERROR", message: "LLM competitor search failed" } },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: { competitors: result.data.competitors },
    });
  });
}
