import type { CDPSession, Page } from "playwright";
import type { BrowserState, Frame, Metadata, Rect, Viewport } from "@bap-protocol/spec";
import { PROTOCOL_VERSION } from "@bap-protocol/spec";
import { axNodesToNodes, type CDPAXNode } from "./accessibility.js";
import { buildRectMap } from "./layout.js";
import { detectWidgets } from "../widgets/detect.js";

export async function extractBrowserState(page: Page): Promise<BrowserState> {
  const url = page.url();
  const [title, viewport, metadata] = await Promise.all([
    page.title(),
    extractViewport(page),
    extractMetadata(page),
  ]);

  const { axNodes, rectByBackendId } = await extractAxAndLayout(page, viewport);
  const frames: Frame[] = [{ id: "main", url }];
  const nodes = axNodesToNodes(axNodes, "main", rectByBackendId);
  const byAxId = new Map(axNodes.map((n) => [n.nodeId, n]));
  const widgets = detectWidgets(nodes, byAxId);

  return {
    version: PROTOCOL_VERSION,
    capturedAt: new Date().toISOString(),
    url,
    title,
    viewport,
    frames,
    nodes,
    widgets,
    overlays: [],
    metadata,
  };
}

async function extractAxAndLayout(
  page: Page,
  viewport: Viewport,
): Promise<{ axNodes: CDPAXNode[]; rectByBackendId: Map<number, Rect> }> {
  const client: CDPSession = await page.context().newCDPSession(page);
  try {
    await Promise.all([
      client.send("Accessibility.enable"),
      client.send("DOMSnapshot.enable"),
    ]);
    const [axRes, snapRes] = await Promise.all([
      client.send("Accessibility.getFullAXTree"),
      client.send("DOMSnapshot.captureSnapshot", { computedStyles: [] }),
    ]);
    const axNodes = (axRes as { nodes: CDPAXNode[] }).nodes;
    const rectByBackendId = buildRectMap(snapRes, viewport);
    return { axNodes, rectByBackendId };
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
