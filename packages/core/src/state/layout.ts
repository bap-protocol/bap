import type { Rect, Viewport } from "@bap-protocol/spec";

interface DOMSnapshotResult {
  documents: DocumentSnapshot[];
}

interface DocumentSnapshot {
  nodes: {
    backendNodeId: number[];
  };
  layout: {
    nodeIndex: number[];
    bounds: number[][];
  };
}

/**
 * Build a map from backendDOMNodeId to its bounding rect using a CDP DOMSnapshot.
 * This lets us resolve layout for any AX node in a single CDP round-trip instead of
 * one `DOM.getBoxModel` call per node.
 */
export function buildRectMap(
  snapshot: unknown,
  viewport: Viewport,
): Map<number, Rect> {
  const snap = snapshot as DOMSnapshotResult;
  const rects = new Map<number, Rect>();
  if (!snap?.documents) return rects;

  for (const doc of snap.documents) {
    const backendIds = doc.nodes.backendNodeId;
    const { nodeIndex, bounds } = doc.layout;
    for (let i = 0; i < nodeIndex.length; i++) {
      const nodeIdx = nodeIndex[i];
      const b = bounds[i];
      if (nodeIdx === undefined || !b || b.length < 4) continue;
      const backendId = backendIds[nodeIdx];
      if (backendId === undefined) continue;

      const [x, y, width, height] = b as [number, number, number, number];
      rects.set(backendId, {
        x,
        y,
        width,
        height,
        inViewport: rectIntersectsViewport(x, y, width, height, viewport),
      });
    }
  }

  return rects;
}

function rectIntersectsViewport(
  x: number,
  y: number,
  w: number,
  h: number,
  vp: Viewport,
): boolean {
  if (w <= 0 || h <= 0) return false;
  const vx0 = vp.scrollX;
  const vy0 = vp.scrollY;
  const vx1 = vx0 + vp.width;
  const vy1 = vy0 + vp.height;
  return x < vx1 && x + w > vx0 && y < vy1 && y + h > vy0;
}
