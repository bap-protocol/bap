import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { WidgetDraft } from "./detect.js";

/**
 * Detect a tooltip. The ARIA tooltip role maps 1:1 to this widget.
 * Presence in the AX tree implies `visible: true` — tooltips hidden
 * via aria-hidden or display:none are elided from the tree.
 */
export function detectTooltip(node: Node, _ax: CDPAXNode): WidgetDraft | null {
  if (node.role !== "tooltip") return null;
  const state: Record<string, unknown> = { visible: true };
  if (node.name) state.text = node.name;
  return { type: "tooltip", nodeIds: [node.id], state, hints: {} };
}
