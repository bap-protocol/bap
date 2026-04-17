import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect a native `<input type="date">` as a datepicker widget. Value is
 * normalized to ISO-8601 (YYYY-MM-DD) — which is what native date inputs
 * already use — or null when unset.
 *
 * Custom JS datepickers (MUI, Ant Design, Flatpickr) use varied DOM shapes
 * and often portal the calendar panel into `document.body`. Their detection
 * requires aria-controls resolution and is deferred to v0.2.
 */
export function detectDatepicker(
  node: Node,
  ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  const backendId = ax.backendDOMNodeId;
  if (backendId === undefined) return null;
  const dom = ctx.domByBackendId.get(backendId);
  if (!dom) return null;
  if (dom.tagName.toLowerCase() !== "input" || dom.attrs["type"]?.toLowerCase() !== "date") {
    return null;
  }

  const raw = node.value ?? dom.attrs["value"] ?? "";
  const value = isIsoDate(raw) ? raw : null;
  const state: Record<string, unknown> = { value, open: false };
  if (isIsoDate(dom.attrs["min"])) state.min = dom.attrs["min"];
  if (isIsoDate(dom.attrs["max"])) state.max = dom.attrs["max"];

  return {
    type: "datepicker",
    nodeIds: [node.id],
    state,
    hints: {
      openTrigger: "click-input",
      monthNavigation: "arrows",
    },
  };
}

function isIsoDate(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
