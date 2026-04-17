export interface DOMMeta {
  tagName: string;
  attrs: Record<string, string>;
}

interface DOMSnapshotResult {
  documents: DocumentSnapshot[];
  strings: string[];
}

interface DocumentSnapshot {
  nodes: {
    nodeType?: number[];
    nodeName?: number[];
    backendNodeId: number[];
    attributes?: number[][];
  };
}

const ELEMENT_NODE = 1;

/**
 * Build a map from backendDOMNodeId to its tag name + attributes, using the
 * top-level strings table from a `DOMSnapshot.captureSnapshot` result.
 *
 * Only element nodes are included. Attribute arrays are flat
 * [nameIdx, valueIdx, nameIdx, valueIdx, ...] pairs.
 */
export function buildDOMMetaMap(snapshot: unknown): Map<number, DOMMeta> {
  const snap = snapshot as DOMSnapshotResult;
  const out = new Map<number, DOMMeta>();
  if (!snap?.documents || !snap.strings) return out;
  const strings = snap.strings;

  for (const doc of snap.documents) {
    const nodes = doc.nodes;
    const backendIds = nodes.backendNodeId;
    const nodeTypes = nodes.nodeType ?? [];
    const nodeNames = nodes.nodeName ?? [];
    const attrs = nodes.attributes ?? [];
    for (let i = 0; i < backendIds.length; i++) {
      if (nodeTypes[i] !== ELEMENT_NODE) continue;
      const nameIdx = nodeNames[i];
      if (nameIdx === undefined || nameIdx < 0) continue;
      const tagName = strings[nameIdx] ?? "";

      const attrPairs = attrs[i] ?? [];
      const attrMap: Record<string, string> = {};
      for (let j = 0; j + 1 < attrPairs.length; j += 2) {
        const n = strings[attrPairs[j]!];
        const v = strings[attrPairs[j + 1]!];
        if (n !== undefined) attrMap[n] = v ?? "";
      }

      const backendId = backendIds[i];
      if (backendId !== undefined) {
        out.set(backendId, { tagName, attrs: attrMap });
      }
    }
  }

  return out;
}
