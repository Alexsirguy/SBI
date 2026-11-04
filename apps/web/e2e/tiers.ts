import type { BrowserContext, Page } from "@playwright/test";

/** Device tiers and network profiles (docs/operations/performance-budgets.md, spec §10). */
export const TIERS = {
  // The ADR 0005 phone: a budget Android on Chrome's Slow 4G.
  low: {
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    cpu: 4,
    network: {
      offline: false,
      latency: 562.5,
      downloadThroughput: 180_000,
      uploadThroughput: 84_000,
    },
  },
  // A mid-range phone on a good 4G connection.
  mid: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    cpu: 2,
    network: {
      offline: false,
      latency: 150,
      downloadThroughput: 1_125_000,
      uploadThroughput: 375_000,
    },
  },
  // A laptop on broadband: no throttling.
  desktop: {
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    cpu: 1,
    network: {
      offline: false,
      latency: 20,
      downloadThroughput: 6_250_000,
      uploadThroughput: 2_500_000,
    },
  },
} as const;

export type Tier = keyof typeof TIERS;

/** Applies a tier's CPU and network throttling to a page, with a cold cache. */
export async function emulateTier(context: BrowserContext, page: Page, tier: Tier) {
  const { viewport, cpu, network } = TIERS[tier];
  await page.setViewportSize(viewport);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", network);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  return cdp;
}
