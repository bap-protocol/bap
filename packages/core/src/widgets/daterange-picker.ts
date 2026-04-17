import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect a native daterange-picker pattern: two `<input type="date">`
 * elements sharing a parent, where the parent declares
 * `data-bap-daterange` or `role="group"` with `aria-label` containing the
 * word "range"/"Zeitraum".
 *
 * This is deliberately narrow for v0.1. Richer detection (MUI, Ant Design
 * range pickers) requires library-specific heuristics that live outside the
 * core. The native pattern is a reliable baseline and unlocks a testable
 * pick-date flow for range inputs.
 */
export function detectDaterangePicker(
  node: Node,
  _ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  if (node.role !== "group") return null;
  const label = (node.name ?? "").toLowerCase();
  if (!/\brange\b|zeitraum/.test(label)) return null;

  const dateInputs = collectDateInputs(node, ctx);
  if (dateInputs.length !== 2) return null;

  const [startNode, startAttrs] = dateInputs[0]!;
  const [endNode, endAttrs] = dateInputs[1]!;
  const start = isoOrNull(startNode.value ?? startAttrs["value"]);
  const end = isoOrNull(endNode.value ?? endAttrs["value"]);

  const state: Record<string, unknown> = { start, end, open: false };
  const min = pickIso(startAttrs["min"], endAttrs["min"]);
  const max = pickIso(startAttrs["max"], endAttrs["max"]);
  if (min) state.min = min;
  if (max) state.max = max;

  return {
    type: "daterange-picker",
    nodeIds: [node.id, startNode.id, endNode.id],
    state,
    hints: {
      openTrigger: "click-input",
      monthNavigation: "arrows",
      twoStep: true,
    },
  };
}

function collectDateInputs(
  root: Node,
  ctx: DetectContext,
): [Node, Record<string, string>][] {
  const out: [Node, Record<string, string>][] = [];
  const walk = (id: string) => {
    const n = ctx.byNodeId.get(id);
    if (!n) return;
    const ax = ctx.byAxId.get(n.id);
    const backendId = ax?.backendDOMNodeId;
    const dom = backendId !== undefined ? ctx.domByBackendId.get(backendId) : undefined;
    if (
      dom &&
      dom.tagName.toLowerCase() === "input" &&
      dom.attrs["type"]?.toLowerCase() === "date"
    ) {
      out.push([n, dom.attrs]);
    }
    for (const cid of n.childIds) walk(cid);
  };
  for (const cid of root.childIds) walk(cid);
  return out;
}

function isoOrNull(v: string | undefined): string | null {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function pickIso(a: string | undefined, b: string | undefined): string | undefined {
  if (isoOrNull(a)) return a;
  if (isoOrNull(b)) return b;
  return undefined;
}
