"use server";

import { requireUser } from "@/lib/auth/session";
import { analyzeImage } from "@/lib/ai/image-analyzer";
import { generateImage, type ImageGenOptions } from "@/lib/ai/image-generator";

export async function analyzeImageAction(imageUrl: string, context?: string) {
  await requireUser();
  return analyzeImage(imageUrl, context);
}

export async function generateImageAction(
  prompt: string,
  options?: ImageGenOptions,
) {
  await requireUser();
  return generateImage(prompt, options);
}
