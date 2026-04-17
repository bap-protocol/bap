import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect a file upload control. In the AX tree `<input type="file">` is
 * exposed as a button, so detection is DOM-driven: we look up the backing
 * element's tagName + attributes via the DOM meta map.
 *
 * v0.1 handles the native input case. Drop-zones (div[data-drop-target])
 * are deferred until the widget detection framework grows generic
 * data-attribute heuristics.
 */
export function detectFileupload(
  node: Node,
  ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  const backendId = ax.backendDOMNodeId;
  if (backendId === undefined) return null;
  const dom = ctx.domByBackendId.get(backendId);
  if (!dom) return null;
  if (dom.tagName.toLowerCase() !== "input" || dom.attrs["type"]?.toLowerCase() !== "file") {
    return null;
  }

  const multiple = dom.attrs["multiple"] !== undefined;
  const acceptRaw = dom.attrs["accept"];
  const accept = acceptRaw
    ? acceptRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const state: Record<string, unknown> = { current: [], multiple };
  if (accept && accept.length > 0) state.accept = accept;

  return {
    type: "fileupload",
    nodeIds: [node.id],
    state,
    hints: { strategy: "input-change" },
  };
}
