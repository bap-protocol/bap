import type { BrowserState, Frame, Metadata, Node, Overlay, Rect, Viewport, Widget } from "@bap-protocol/spec";
import { PROTOCOL_VERSION } from "@bap-protocol/spec";
import type { CDPSession } from "../transport/cdp-client.js";
import { axNodesToNodes, type CDPAXNode } from "./accessibility.js";
import { buildRectMap } from "./layout.js";
import { buildDOMMetaMap, type DOMMeta } from "./dom-meta.js";
import { detectWidgets } from "../widgets/detect.js";

interface CDPFrame {
  id: string;
  parentId?: string;
  url: string;
}

export interface ExtractResult {
  state: BrowserState;
  /** Sidecar: map from Node.id → CDP backendNodeId. Used by the transport to
   * issue DOM-scoped CDP calls (DOM.setFileInputFiles, DOM.focus, etc.). */
  backendIdByNodeId: Map<string, number>;
}

export async function extractBrowserState(client: CDPSession): Promise<BrowserState> {
  return (await extractBrowserStateWithBackendIds(client)).state;
}

export async function extractBrowserStateWithBackendIds(
  client: CDPSession,
): Promise<ExtractResult> {
  const [viewport, pageInfo] = await Promise.all([
    extractViewport(client),
    extractPageInfo(client),
  ]);

  const { frames: cdpFrames, axByFrame, rectByBackendId, domByBackendId } =
    await extractAxAndLayout(client, viewport);

  const frames: Frame[] = cdpFrames.map((f) => {
    const frame: Frame = { id: f.id, url: f.url };
    if (f.parentId) frame.parentFrameId = f.parentId;
    return frame;
  });

  const nodes: Node[] = [];
  const byAxId = new Map<string, CDPAXNode>();
  const backendIdByNodeId = new Map<string, number>();
  for (const frame of cdpFrames) {
    const axNodes = axByFrame[frame.id] ?? [];
    nodes.push(...axNodesToNodes(axNodes, frame.id, rectByBackendId));
    for (const ax of axNodes) {
      byAxId.set(`${frame.id}:${ax.nodeId}`, ax);
      if (!ax.ignored && ax.backendDOMNodeId !== undefined) {
        backendIdByNodeId.set(`${frame.id}:${ax.nodeId}`, ax.backendDOMNodeId);
      }
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
    url: pageInfo.url,
    title: pageInfo.title,
    viewport,
    frames,
    nodes,
    widgets,
    overlays,
    metadata: pageInfo.metadata,
  };
  if (focusedNode) state.focus = { nodeId: focusedNode.id, frameId: focusedNode.frameId };
  return { state, backendIdByNodeId };
}

async function extractAxAndLayout(
  client: CDPSession,
  viewport: Viewport,
): Promise<{
  frames: CDPFrame[];
  axByFrame: Record<string, CDPAXNode[]>;
  rectByBackendId: Map<number, Rect>;
  domByBackendId: Map<number, DOMMeta>;
}> {
  await Promise.all([
    client.send("Accessibility.enable"),
    client.send("DOMSnapshot.enable"),
  ]);

  const frameTreeRes = await client.send("Page.getFrameTree");
  const frames = flattenFrames(frameTreeRes.frameTree as unknown as CDPFrameTree);

  const axByFrame: Record<string, CDPAXNode[]> = {};
  for (const frame of frames) {
    try {
      const axRes = await client.send("Accessibility.getFullAXTree", { frameId: frame.id });
      axByFrame[frame.id] = axRes.nodes as unknown as CDPAXNode[];
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

async function extractViewport(client: CDPSession): Promise<Viewport> {
  const res = await client.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    })`,
    returnByValue: true,
  });
  return JSON.parse((res.result.value as string) ?? "{}") as Viewport;
}

interface PageInfo {
  url: string;
  title: string;
  metadata: Metadata;
}

async function extractPageInfo(client: CDPSession): Promise<PageInfo> {
  const res = await client.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      url: location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    })`,
    returnByValue: true,
  });
  const o = JSON.parse((res.result.value as string) ?? "{}") as {
    url: string;
    title: string;
    userAgent: string;
    timezone: string;
    language: string;
  };
  return {
    url: o.url,
    title: o.title,
    metadata: { userAgent: o.userAgent, timezone: o.timezone, language: o.language },
  };
}
