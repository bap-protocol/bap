import type {
  BrowserState,
  Change,
  Node,
  NodeModifiedChange,
  NodeState,
  Overlay,
  Rect,
  StateDiff,
  Viewport,
  Widget,
  WidgetModifiedChange,
} from "@bap-protocol/spec";
import { PROTOCOL_VERSION } from "@bap-protocol/spec";

/**
 * Compute a deterministic diff between two BrowserState snapshots.
 *
 * Identity rule (RFC 0004):
 * - Nodes are identified across snapshots by `(frameId, locator.strategy, locator.value)`.
 * - Widgets are identified by their anchor node's key plus widget type.
 * - Nodes/widgets that share a key within a snapshot are paired by appearance order.
 */
export function computeDiff(before: BrowserState, after: BrowserState): StateDiff {
  const changes: Change[] = [];

  if (before.url !== after.url) {
    changes.push({ kind: "url-changed", from: before.url, to: after.url });
  }
  if (before.title !== after.title) {
    changes.push({ kind: "title-changed", from: before.title, to: after.title });
  }

  const viewportFields = diffViewport(before.viewport, after.viewport);
  if (viewportFields) {
    changes.push({ kind: "viewport-changed", fields: viewportFields });
  }

  diffNodes(before.nodes, after.nodes, changes);
  diffWidgets(before, after, changes);
  diffOverlays(before.overlays, after.overlays, before.nodes, after.nodes, changes);

  return {
    version: PROTOCOL_VERSION,
    from: before.capturedAt,
    to: after.capturedAt,
    changes,
  };
}

function nodeKey(n: Node): string {
  return `${n.frameId}|${n.locator.strategy}|${n.locator.value}`;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function diffNodes(before: Node[], after: Node[], changes: Change[]): void {
  const b = groupBy(before, nodeKey);
  const a = groupBy(after, nodeKey);
  const allKeys = new Set([...b.keys(), ...a.keys()]);

  for (const key of allKeys) {
    const bList = b.get(key) ?? [];
    const aList = a.get(key) ?? [];
    const pairs = Math.min(bList.length, aList.length);

    for (let i = 0; i < pairs; i++) {
      const modified = nodeFieldDiff(bList[i]!, aList[i]!);
      if (modified) changes.push(modified);
    }
    for (let i = pairs; i < bList.length; i++) {
      const n = bList[i]!;
      changes.push({ kind: "node-removed", nodeId: n.id, frameId: n.frameId });
    }
    for (let i = pairs; i < aList.length; i++) {
      changes.push({ kind: "node-added", node: aList[i]! });
    }
  }
}

function nodeFieldDiff(b: Node, a: Node): NodeModifiedChange | null {
  const fields: Record<string, unknown> = {};

  if (b.name !== a.name) fields.name = a.name;
  if (b.value !== a.value) fields.value = a.value;
  if (b.description !== a.description) fields.description = a.description;
  if (b.interactable !== a.interactable) fields.interactable = a.interactable;
  if (b.editable !== a.editable) fields.editable = a.editable;

  const stateKeys = new Set<keyof NodeState>([
    ...(Object.keys(b.state) as (keyof NodeState)[]),
    ...(Object.keys(a.state) as (keyof NodeState)[]),
  ]);
  for (const k of stateKeys) {
    if (b.state[k] !== a.state[k]) {
      fields[`state.${k}`] = a.state[k];
    }
  }

  if (!rectEqual(b.rect, a.rect)) {
    fields.rect = a.rect;
  }

  if (Object.keys(fields).length === 0) return null;
  return {
    kind: "node-modified",
    nodeId: a.id,
    frameId: a.frameId,
    fields,
  };
}

function rectEqual(b: Rect | undefined, a: Rect | undefined): boolean {
  if (b === a) return true;
  if (!b || !a) return false;
  return (
    b.x === a.x &&
    b.y === a.y &&
    b.width === a.width &&
    b.height === a.height &&
    b.inViewport === a.inViewport
  );
}

function diffViewport(b: Viewport, a: Viewport): Partial<Viewport> | null {
  const fields: Partial<Viewport> = {};
  if (b.width !== a.width) fields.width = a.width;
  if (b.height !== a.height) fields.height = a.height;
  if (b.devicePixelRatio !== a.devicePixelRatio) fields.devicePixelRatio = a.devicePixelRatio;
  if (b.scrollX !== a.scrollX) fields.scrollX = a.scrollX;
  if (b.scrollY !== a.scrollY) fields.scrollY = a.scrollY;
  return Object.keys(fields).length ? fields : null;
}

function widgetKey(widget: Widget, nodes: Node[]): string | null {
  const anchorId = widget.nodeIds[0];
  if (!anchorId) return null;
  const anchor = nodes.find((n) => n.id === anchorId);
  if (!anchor) return null;
  return `${widget.type}|${nodeKey(anchor)}`;
}

function diffWidgets(before: BrowserState, after: BrowserState, changes: Change[]): void {
  const bMap = new Map<string, Widget>();
  for (const w of before.widgets) {
    const k = widgetKey(w, before.nodes);
    if (k) bMap.set(k, w);
  }
  const aMap = new Map<string, Widget>();
  for (const w of after.widgets) {
    const k = widgetKey(w, after.nodes);
    if (k) aMap.set(k, w);
  }

  for (const [k, w] of bMap) {
    if (!aMap.has(k)) {
      changes.push({ kind: "widget-removed", widgetId: w.id });
    }
  }
  for (const [k, w] of aMap) {
    const prev = bMap.get(k);
    if (!prev) {
      changes.push({ kind: "widget-added", widget: w });
      continue;
    }
    const mod = widgetFieldDiff(prev, w);
    if (mod) changes.push(mod);
  }
}

function widgetFieldDiff(b: Widget, a: Widget): WidgetModifiedChange | null {
  const fields: Record<string, unknown> = {};
  const stateKeys = new Set([...Object.keys(b.state), ...Object.keys(a.state)]);
  for (const k of stateKeys) {
    if (!deepEqual(b.state[k], a.state[k])) {
      fields[`state.${k}`] = a.state[k];
    }
  }
  const hintKeys = new Set([...Object.keys(b.hints), ...Object.keys(a.hints)]);
  for (const k of hintKeys) {
    if (!deepEqual(b.hints[k], a.hints[k])) {
      fields[`hints.${k}`] = a.hints[k];
    }
  }
  if (Object.keys(fields).length === 0) return null;
  return { kind: "widget-modified", widgetId: a.id, fields };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

function diffOverlays(
  before: Overlay[],
  after: Overlay[],
  beforeNodes: Node[],
  afterNodes: Node[],
  changes: Change[],
): void {
  const beforeKeys = new Set(
    before
      .map((o) => overlayKey(o, beforeNodes))
      .filter((k): k is string => k !== null),
  );
  const afterKeys = new Map<string, Overlay>();
  for (const o of after) {
    const k = overlayKey(o, afterNodes);
    if (k) afterKeys.set(k, o);
  }

  for (const [k, o] of afterKeys) {
    if (!beforeKeys.has(k)) changes.push({ kind: "overlay-appeared", overlay: o });
  }
  for (const o of before) {
    const k = overlayKey(o, beforeNodes);
    if (k && !afterKeys.has(k)) changes.push({ kind: "overlay-dismissed", nodeId: o.nodeId });
  }
}

function overlayKey(o: Overlay, nodes: Node[]): string | null {
  const node = nodes.find((n) => n.id === o.nodeId);
  if (!node) return null;
  return `${o.type}|${nodeKey(node)}`;
}
