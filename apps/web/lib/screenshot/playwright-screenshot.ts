import "server-only";

export type ScreenshotResult =
  | {
      ok: true;
      /** data:image/jpeg;base64,... URI ready to drop into <img src>. */
      dataUri: string;
      width: number;
      height: number;
    }
  | { ok: false; error: ScreenshotError };

export type ScreenshotError =
  | { kind: "invalid_url" }
  | { kind: "browser_unavailable"; message: string }
  | { kind: "navigation_failed"; message: string }
  | { kind: "timeout" }
  | { kind: "capture_failed"; message: string };

/**
 * Capture a desktop-viewport screenshot of a URL using a headless
 * Chromium via Playwright. Returns the image as a base64 data URI so it
 * can be rendered without round-tripping through a CDN.
 *
 * Operational notes:
 *   - `playwright` is in serverExternalPackages so Turbopack doesn't try
 *     to bundle Chromium binaries.
 *   - Browser binaries must be downloaded once:
 *     `pnpm -F web exec playwright install chromium`
 *   - 30 s budget per capture. Browser is launched + closed per call —
 *     simple, no warm-pool needed for our low traffic.
 *   - On Vercel deploy this will fail without a Chromium adapter
 *     (sparticuz/chromium). For local dev + self-hosted, works out of
 *     the box.
 */
export async function captureDesktopScreenshot(
  url: string,
  options: {
    /** Logical viewport size. Default 1440×900 for a modern desktop. */
    viewport?: { width: number; height: number };
    /** Capture only the above-the-fold area instead of the full page. */
    aboveTheFold?: boolean;
  } = {},
): Promise<ScreenshotResult> {
  if (!isValidHttpUrl(url)) {
    return { ok: false, error: { kind: "invalid_url" } };
  }

  const viewport = options.viewport ?? { width: 1440, height: 900 };
  const fullPage = !options.aboveTheFold;

  // Dynamic import so the package only loads on the server path that
  // actually needs it — Next.js won't try to trace it into client bundles.
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "browser_unavailable",
        message:
          err instanceof Error ? err.message : "Failed to load playwright",
      },
    };
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "browser_unavailable",
        message:
          (err instanceof Error ? err.message : "Failed to launch Chromium") +
          " — try `pnpm -F web exec playwright install chromium`",
      },
    };
  }

  try {
    const context = await browser.newContext({
      viewport,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      locale: "en-US",
      // Block heavy resources to keep capture fast — but allow images
      // since the screenshot needs them.
    });
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
    } catch (err) {
      if (err instanceof Error && /Timeout/i.test(err.message)) {
        return { ok: false, error: { kind: "timeout" } };
      }
      return {
        ok: false,
        error: {
          kind: "navigation_failed",
          message: err instanceof Error ? err.message : "Navigation failed",
        },
      };
    }

    let buffer: Buffer;
    try {
      buffer = await page.screenshot({
        type: "jpeg",
        quality: 80,
        fullPage,
      });
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "capture_failed",
          message: err instanceof Error ? err.message : "Screenshot failed",
        },
      };
    }

    const dataUri = `data:image/jpeg;base64,${buffer.toString("base64")}`;

    return {
      ok: true,
      dataUri,
      width: viewport.width,
      // height isn't easily known for full-page; fall back to viewport.
      height: viewport.height,
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
