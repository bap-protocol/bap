import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { WidgetDraft } from "./detect.js";

/**
 * Detect a toggle switch: any node with `role="switch"`. The ARIA switch
 * role is semantically distinct from checkbox and maps 1:1 to this widget.
 */
export function detectToggleswitch(node: Node, _ax: CDPAXNode): WidgetDraft | null {
  if (node.role !== "switch") return null;
  return {
    type: "toggleswitch",
    nodeIds: [node.id],
    state: { checked: node.state.checked === true },
    hints: {},
  };
}
