import type { Page } from "playwright";
import type { BrowserState, Frame, Metadata, Viewport } from "@bap-protocol/spec";
import { PROTOCOL_VERSION } from "@bap-protocol/spec";
import { axNodesToNodes, type CDPAXNode } from "./accessibility.js";

export async function extractBrowserState(page: Page): Promise<BrowserState> {
  const url = page.url();
  const title = await page.title();
  const [viewport, metadata, axNodes] = await Promise.all([
    extractViewport(page),
    extractMetadata(page),
    extractAxTree(page),
  ]);

  const frames: Frame[] = [{ id: "main", url }];
  const nodes = axNodesToNodes(axNodes, "main");

  return {
    version: PROTOCOL_VERSION,
    capturedAt: new Date().toISOString(),
    url,
    title,
    viewport,
    frames,
    nodes,
    widgets: [],
    overlays: [],
    metadata,
  };
}

async function extractAxTree(page: Page): Promise<CDPAXNode[]> {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Accessibility.enable");
    const result = (await client.send("Accessibility.getFullAXTree")) as { nodes: CDPAXNode[] };
    return result.nodes;
  } finally {
    await client.detach();
  }
}

function extractViewport(page: Page): Promise<Viewport> {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }));
}

function extractMetadata(page: Page): Promise<Metadata> {
  return page.evaluate(() => ({
    userAgent: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  }));
}
