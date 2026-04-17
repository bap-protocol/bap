import type { CDPSession, Page } from "playwright";
import type { BrowserState, Frame, Metadata, Node, Overlay, Rect, Viewport, Widget } from "@bap-protocol/spec";
import { PROTOCOL_VERSION } from "@bap-protocol/spec";
import { axNodesToNodes, type CDPAXNode } from "./accessibility.js";
import { buildRectMap } from "./layout.js";
import { buildDOMMetaMap, type DOMMeta } from "./dom-meta.js";
import { detectWidgets } from "../widgets/detect.js";

interface CDPFrame {
  id: string;
  parentId?: string;
  url: string;
}

export async function extractBrowserState(page: Page): Promise<BrowserState> {
  const url = page.url();
  const [title, viewport, metadata] = await Promise.all([
    page.title(),
    extractViewport(page),
    extractMetadata(page),
  ]);

  const { frames: cdpFrames, axByFrame, rectByBackendId, domByBackendId } =
    await extractAxAndLayout(page, viewport);

  const frames: Frame[] = cdpFrames.map((f) => {
    const frame: Frame = { id: f.id, url: f.url };
    if (f.parentId) frame.parentFrameId = f.parentId;
    return frame;
  });

  const nodes: Node[] = [];
  const byAxId = new Map<string, CDPAXNode>();
  for (const frame of cdpFrames) {
    const axNodes = axByFrame[frame.id] ?? [];
    nodes.push(...axNodesToNodes(axNodes, frame.id, rectByBackendId));
    for (const ax of axNodes) {
      byAxId.set(`${frame.id}:${ax.nodeId}`, ax);
    }
  }

  const widgets = detectWidgets(nodes, byAxId, domByBackendId);
  // The AX tree reports focused=true on every focused ancestor, including
  // RootWebArea. Take the deepest one (last in document order) so that we
  // point at the actual focused element.
  const focusedNode = findDeepestFocused(nodes);
  const overlays = extractOverlays(nodes, widgets);

  const state: BrowserState = {
    version: PROTOCOL_VERSION,
    capturedAt: new Date().toISOString(),
    url,
    title,
    viewport,
    frames,
    nodes,
    widgets,
    overlays,
    metadata,
  };
  if (focusedNode) state.focus = { nodeId: focusedNode.id, frameId: focusedNode.frameId };
  return state;
}

async function extractAxAndLayout(
  page: Page,
  viewport: Viewport,
): Promise<{
  frames: CDPFrame[];
  axByFrame: Record<string, CDPAXNode[]>;
  rectByBackendId: Map<number, Rect>;
  domByBackendId: Map<number, DOMMeta>;
}> {
  const client: CDPSession = await page.context().newCDPSession(page);
  try {
    await Promise.all([
      client.send("Accessibility.enable"),
      client.send("DOMSnapshot.enable"),
    ]);

    const frameTreeRes = (await client.send("Page.getFrameTree")) as {
      frameTree: CDPFrameTree;
    };
    const frames = flattenFrames(frameTreeRes.frameTree);

    const axByFrame: Record<string, CDPAXNode[]> = {};
    for (const frame of frames) {
      try {
        const axRes = (await client.send("Accessibility.getFullAXTree", {
          frameId: frame.id,
        })) as { nodes: CDPAXNode[] };
        axByFrame[frame.id] = axRes.nodes;
      } catch {
        // Cross-origin or detached frames may refuse AX queries; skip them
        // rather than failing the whole snapshot.
        axByFrame[frame.id] = [];
      }
    }

    const snapRes = await client.send("DOMSnapshot.captureSnapshot", { computedStyles: [] });
    const rectByBackendId = buildRectMap(snapRes, viewport);
    const domByBackendId = buildDOMMetaMap(snapRes);

    return { frames, axByFrame, rectByBackendId, domByBackendId };
  } finally {
    await client.detach();
  }
}

interface CDPFrameTree {
  frame: { id: string; parentId?: string; url: string };
  childFrames?: CDPFrameTree[];
}

function flattenFrames(tree: CDPFrameTree): CDPFrame[] {
  const out: CDPFrame[] = [];
  const walk = (node: CDPFrameTree, parentId?: string) => {
    const f: CDPFrame = { id: node.frame.id, url: node.frame.url };
    if (parentId) f.parentId = parentId;
    out.push(f);
    for (const child of node.childFrames ?? []) walk(child, node.frame.id);
  };
  walk(tree);
  return out;
}

function findDeepestFocused(nodes: Node[]): Node | undefined {
  let last: Node | undefined;
  for (const n of nodes) {
    if (n.state.focused === true && n.role !== "RootWebArea") last = n;
  }
  return last;
}

function extractOverlays(nodes: Node[], widgets: Widget[]): Overlay[] {
  const overlays: Overlay[] = [];
  const dialogWidgets = new Map<string, Widget>();
  for (const w of widgets) {
    if (w.type === "dialog") {
      const anchor = w.nodeIds[0];
      if (anchor) dialogWidgets.set(anchor, w);
    }
  }

  for (const n of nodes) {
    if (n.role === "dialog" || n.role === "alertdialog") {
      const widget = dialogWidgets.get(n.id);
      const modal = widget ? (widget.state as { modal?: boolean }).modal === true : false;
      overlays.push({ nodeId: n.id, type: "modal", blocking: modal });
    } else if (n.role === "menu" && n.state.expanded === true) {
      overlays.push({ nodeId: n.id, type: "menu", blocking: false });
    } else if (n.role === "tooltip") {
      overlays.push({ nodeId: n.id, type: "tooltip", blocking: false });
    }
  }
  return overlays;
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
