import "server-only";

// ─── Types ────────────────────────────────────────────────────────────

export type MobileFriendlyCheck = {
  id: string;
  /** Short human label. */
  label: string;
  /** Severity: pass = good, fail = broken, warn = concern, info = neutral. */
  status: "pass" | "fail" | "warn" | "info";
  /** One-sentence explanation of what was found. */
  detail: string;
  /** Score weight contributed (0 if neutral / info-only). */
  weight: number;
  /** Max weight this check could contribute. */
  maxWeight: number;
};

export type MobileFriendlyReport = {
  url: string;
  finalUrl: string;
  /** 0–100 weighted score. */
  score: number;
  band: "weak" | "warming" | "strong";
  checks: MobileFriendlyCheck[];
};

// ─── HTML probe ──────────────────────────────────────────────────────

/**
 * Run a fast HTML-only probe for mobile-friendliness signals. No browser,
 * no external API — just regex over the raw HTML. Combined with the
 * Microlink screenshots in the tool UI, gives a complete picture.
 */
export function analyzeMobileFriendliness(
  url: string,
  finalUrl: string,
  html: string,
): MobileFriendlyReport {
  const checks: MobileFriendlyCheck[] = [];

  // 1. Viewport meta tag — the single biggest signal
  const viewportMatch =
    /<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']viewport["']/i.exec(html);

  if (!viewportMatch) {
    checks.push({
      id: "viewport-present",
      label: "Viewport meta tag",
      status: "fail",
      detail:
        "No <meta name=\"viewport\"> tag found. Mobile browsers will render the site at a fake 980 px viewport and shrink it to fit — terrible UX.",
      weight: 0,
      maxWeight: 30,
    });
  } else {
    const content = viewportMatch[1] ?? "";
    const hasDeviceWidth = /width\s*=\s*device-width/i.test(content);
    const hasInitialScale = /initial-scale\s*=\s*1(?:\.0+)?/i.test(content);
    const blocksZoom =
      /user-scalable\s*=\s*(no|0)/i.test(content) ||
      /maximum-scale\s*=\s*1(?:\.0+)?/i.test(content);
    const fixedWidth = /width\s*=\s*\d+(?!.*device-width)/i.test(content);

    if (fixedWidth) {
      checks.push({
        id: "viewport-present",
        label: "Viewport meta tag",
        status: "fail",
        detail: `Viewport uses a fixed pixel width: "${content}". Replace with width=device-width, initial-scale=1.`,
        weight: 5,
        maxWeight: 30,
      });
    } else if (hasDeviceWidth && hasInitialScale) {
      checks.push({
        id: "viewport-present",
        label: "Viewport meta tag",
        status: "pass",
        detail: `Configured correctly: "${content}".`,
        weight: 30,
        maxWeight: 30,
      });
    } else if (hasDeviceWidth) {
      checks.push({
        id: "viewport-present",
        label: "Viewport meta tag",
        status: "warn",
        detail: `Present but missing initial-scale=1: "${content}". iOS Safari can over-zoom on rotate without it.`,
        weight: 22,
        maxWeight: 30,
      });
    } else {
      checks.push({
        id: "viewport-present",
        label: "Viewport meta tag",
        status: "warn",
        detail: `Present but missing width=device-width: "${content}". Add it so the layout viewport tracks the device.`,
        weight: 15,
        maxWeight: 30,
      });
    }

    if (blocksZoom) {
      checks.push({
        id: "viewport-zoom",
        label: "Pinch-to-zoom allowed",
        status: "fail",
        detail:
          "Viewport disables zoom (user-scalable=no or maximum-scale=1). This is an accessibility violation — users with low vision rely on pinch-zoom.",
        weight: 0,
        maxWeight: 10,
      });
    } else {
      checks.push({
        id: "viewport-zoom",
        label: "Pinch-to-zoom allowed",
        status: "pass",
        detail: "Zoom is not blocked.",
        weight: 10,
        maxWeight: 10,
      });
    }
  }

  // 2. Responsive images — srcset / picture
  const srcsetCount = countMatches(html, /<img\b[^>]*\bsrcset\s*=/gi);
  const pictureCount = countMatches(html, /<picture\b/gi);
  const totalImgCount = countMatches(html, /<img\b/gi);
  const responsiveImgRatio =
    totalImgCount > 0 ? (srcsetCount + pictureCount) / totalImgCount : 0;

  if (totalImgCount === 0) {
    checks.push({
      id: "responsive-images",
      label: "Responsive images",
      status: "info",
      detail: "No <img> tags found on this page — nothing to check.",
      weight: 15,
      maxWeight: 15,
    });
  } else if (srcsetCount + pictureCount === 0) {
    checks.push({
      id: "responsive-images",
      label: "Responsive images",
      status: "warn",
      detail: `${totalImgCount} <img> tags found, none using srcset or <picture>. Mobile devices download desktop-sized images, wasting bandwidth.`,
      weight: 5,
      maxWeight: 15,
    });
  } else if (responsiveImgRatio >= 0.5) {
    checks.push({
      id: "responsive-images",
      label: "Responsive images",
      status: "pass",
      detail: `${srcsetCount} srcset + ${pictureCount} <picture> across ${totalImgCount} images (${Math.round(responsiveImgRatio * 100)}% responsive).`,
      weight: 15,
      maxWeight: 15,
    });
  } else {
    checks.push({
      id: "responsive-images",
      label: "Responsive images",
      status: "warn",
      detail: `Only ${Math.round(responsiveImgRatio * 100)}% of images use srcset/picture (${srcsetCount + pictureCount} of ${totalImgCount}). Mobile users on cellular networks pay for extra bytes.`,
      weight: 8,
      maxWeight: 15,
    });
  }

  // 3. Theme color (Chrome address bar / iOS PWA tinting)
  const hasThemeColor =
    /<meta[^>]*name=["']theme-color["']/i.test(html);
  checks.push({
    id: "theme-color",
    label: "Theme color metadata",
    status: hasThemeColor ? "pass" : "warn",
    detail: hasThemeColor
      ? "<meta name=\"theme-color\"> present — Chrome/Edge mobile will tint the address bar to match your brand."
      : "No theme-color meta tag. Mobile browser chrome stays default-grey instead of matching your brand.",
    weight: hasThemeColor ? 5 : 0,
    maxWeight: 5,
  });

  // 4. Apple mobile-web-app metadata (PWA / homescreen)
  const hasAppleCapable =
    /<meta[^>]*name=["']apple-mobile-web-app-capable["']/i.test(html);
  const hasAppleIcon =
    /<link[^>]*rel=["']apple-touch-icon/i.test(html);
  const appleScore = (hasAppleCapable ? 3 : 0) + (hasAppleIcon ? 2 : 0);
  checks.push({
    id: "apple-mobile-web",
    label: "iOS home-screen support",
    status: appleScore >= 4 ? "pass" : appleScore > 0 ? "warn" : "info",
    detail:
      appleScore >= 4
        ? "apple-touch-icon and apple-mobile-web-app-capable both set — iOS users can add to home screen with a proper icon."
        : appleScore > 0
          ? `Partial iOS metadata (touch-icon: ${hasAppleIcon}, web-app-capable: ${hasAppleCapable}).`
          : "No iOS-specific meta tags. Optional but nice — apple-touch-icon especially.",
    weight: appleScore,
    maxWeight: 5,
  });

  // 5. Legacy plugins — Flash / Java / ActiveX
  const hasFlash =
    /<object\b[^>]*type=["']application\/x-shockwave-flash/i.test(html) ||
    /<embed\b[^>]*application\/x-shockwave-flash/i.test(html);
  const hasJavaApplet = /<applet\b/i.test(html);
  const hasActiveX = /<object\b[^>]*classid=["']clsid:/i.test(html);
  const hasLegacy = hasFlash || hasJavaApplet || hasActiveX;
  checks.push({
    id: "no-legacy-plugins",
    label: "No legacy plugins (Flash / Java / ActiveX)",
    status: hasLegacy ? "fail" : "pass",
    detail: hasLegacy
      ? `Legacy plugin detected: ${[hasFlash && "Flash", hasJavaApplet && "Java applet", hasActiveX && "ActiveX"].filter(Boolean).join(", ")}. Mobile browsers cannot render these.`
      : "No Flash / Java applets / ActiveX detected.",
    weight: hasLegacy ? 0 : 10,
    maxWeight: 10,
  });

  // 6. HTML lang attribute — accessibility + SEO
  const hasLang = /<html[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html);
  checks.push({
    id: "html-lang",
    label: "Document language declared",
    status: hasLang ? "pass" : "warn",
    detail: hasLang
      ? "<html lang=\"…\"> is set."
      : "<html> has no lang attribute. Mobile screen readers won't know what language to pronounce.",
    weight: hasLang ? 5 : 0,
    maxWeight: 5,
  });

  // 7. Charset declared early (avoids encoding-related layout shifts)
  const hasCharset = /<meta[^>]*charset=/i.test(html);
  checks.push({
    id: "charset",
    label: "Character encoding declared",
    status: hasCharset ? "pass" : "warn",
    detail: hasCharset
      ? "<meta charset> is set."
      : "No <meta charset>. Some mobile browsers may guess wrong, causing layout shifts as encoding is detected.",
    weight: hasCharset ? 5 : 0,
    maxWeight: 5,
  });

  // 8. Touch icons sized properly (heuristic: link rel=icon with sizes attr)
  const hasSizedIcon =
    /<link[^>]*rel=["'](icon|shortcut icon)["'][^>]*sizes=/i.test(html);
  checks.push({
    id: "favicons",
    label: "Sized favicon variants",
    status: hasSizedIcon ? "pass" : "info",
    detail: hasSizedIcon
      ? "Sized favicon variants declared — devices pick the best fit."
      : "No sized favicon variants found. A single non-sized favicon still works but isn't optimal across DPIs.",
    weight: hasSizedIcon ? 5 : 0,
    maxWeight: 5,
  });

  // 9. Mobile-targeted stylesheets (heuristic: any <link rel=stylesheet media="…">)
  const mediaCount = countMatches(
    html,
    /<link[^>]*rel=["']stylesheet["'][^>]*\bmedia\s*=\s*["'][^"']+["']/gi,
  );
  if (mediaCount > 0) {
    checks.push({
      id: "media-queries",
      label: "Media-targeted stylesheets",
      status: "pass",
      detail: `${mediaCount} stylesheet${mediaCount === 1 ? "" : "s"} use a media attribute — strong signal of intentional responsive design.`,
      weight: 10,
      maxWeight: 10,
    });
  } else {
    checks.push({
      id: "media-queries",
      label: "Media-targeted stylesheets",
      status: "info",
      detail:
        "No stylesheets use a media attribute. Doesn't mean unresponsive — media queries are usually inside the CSS file itself, which we don't fetch.",
      weight: 10,
      maxWeight: 10,
    });
  }

  // ─── Score + band ─────────────────────────────────────────────────
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const maxTotal = checks.reduce((sum, c) => sum + c.maxWeight, 0);
  const score = maxTotal > 0 ? Math.round((totalWeight / maxTotal) * 100) : 0;
  const band: MobileFriendlyReport["band"] =
    score >= 80 ? "strong" : score >= 50 ? "warming" : "weak";

  return { url, finalUrl, score, band, checks };
}

function countMatches(haystack: string, pattern: RegExp): number {
  let count = 0;
  while (pattern.exec(haystack) !== null) count++;
  // Reset lastIndex for stateful globals
  pattern.lastIndex = 0;
  return count;
}
