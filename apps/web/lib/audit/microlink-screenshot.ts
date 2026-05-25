import "server-only";

// ─── Device presets ───────────────────────────────────────────────────

export type DevicePreset = {
  id: string;
  label: string;
  /** Microlink/Puppeteer device name. Undefined → use custom viewport. */
  device?: string;
  /** Logical CSS viewport (used when device is not specified). */
  viewport: { width: number; height: number };
  /** UI hint: "mobile" | "tablet" | "desktop". */
  formFactor: "mobile" | "tablet" | "desktop";
};

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: "iphone-14",
    label: "iPhone 14",
    device: "iPhone 14",
    viewport: { width: 390, height: 844 },
    formFactor: "mobile",
  },
  {
    id: "pixel-7",
    label: "Pixel 7",
    device: "Pixel 7",
    viewport: { width: 412, height: 915 },
    formFactor: "mobile",
  },
  {
    id: "galaxy-s22",
    label: "Galaxy S22",
    // Microlink/Puppeteer doesn't carry a Galaxy S22 preset; fall back to
    // custom viewport at the same logical CSS dimensions.
    viewport: { width: 360, height: 780 },
    formFactor: "mobile",
  },
  {
    id: "ipad",
    label: "iPad",
    device: "iPad",
    viewport: { width: 768, height: 1024 },
    formFactor: "tablet",
  },
  {
    id: "desktop",
    label: "Desktop",
    viewport: { width: 1440, height: 900 },
    formFactor: "desktop",
  },
];

// ─── Public types ─────────────────────────────────────────────────────

export type DeviceShot = {
  preset: DevicePreset;
  /** CDN URL of the rendered screenshot, or null on failure. */
  screenshotUrl: string | null;
  /** Error message when screenshotUrl is null. */
  error: string | null;
};

// ─── Fetch ────────────────────────────────────────────────────────────

const MICROLINK_ENDPOINT = "https://api.microlink.io";

/**
 * Capture screenshots for all device presets in parallel. Each device is
 * a separate Microlink call — 5 calls counts as 5 against the free tier
 * quota (50/day without API key). Returns one DeviceShot per preset,
 * with errors captured per-device so a single failure doesn't break the
 * whole grid.
 */
export async function captureDeviceShots(
  url: string,
): Promise<DeviceShot[]> {
  const settled = await Promise.allSettled(
    DEVICE_PRESETS.map((p) => captureOne(url, p)),
  );

  return settled.map((res, i) => {
    const preset = DEVICE_PRESETS[i]!;
    if (res.status === "fulfilled") return res.value;
    return {
      preset,
      screenshotUrl: null,
      error: res.reason instanceof Error ? res.reason.message : "Unknown error",
    };
  });
}

async function captureOne(
  url: string,
  preset: DevicePreset,
): Promise<DeviceShot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const target = new URL(MICROLINK_ENDPOINT);
    target.searchParams.set("url", url);
    target.searchParams.set("screenshot", "true");
    target.searchParams.set("meta", "false"); // skip metadata extraction
    target.searchParams.set("waitUntil", "networkidle0");

    if (preset.device) {
      // Microlink supports Puppeteer KnownDevices names directly.
      target.searchParams.set("device", preset.device);
    } else {
      target.searchParams.set(
        "viewport.width",
        String(preset.viewport.width),
      );
      target.searchParams.set(
        "viewport.height",
        String(preset.viewport.height),
      );
    }

    const res = await fetch(target, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        preset,
        screenshotUrl: null,
        error: `Microlink returned ${res.status}${
          res.status === 429
            ? " (free-tier quota of 50/day exhausted — try again tomorrow or sign up for a free key)"
            : ""
        }`,
      };
    }

    const json = (await res.json()) as {
      status?: string;
      data?: { screenshot?: { url?: string } };
      message?: string;
    };

    if (json.status !== "success" || !json.data?.screenshot?.url) {
      return {
        preset,
        screenshotUrl: null,
        error: json.message || "Microlink did not return a screenshot URL",
      };
    }

    return {
      preset,
      screenshotUrl: json.data.screenshot.url,
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      preset,
      screenshotUrl: null,
      error:
        err instanceof Error && err.name === "AbortError"
          ? "Screenshot timed out after 30s"
          : err instanceof Error
            ? err.message
            : "Network error",
    };
  }
}
