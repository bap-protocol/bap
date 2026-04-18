import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import { collectDescendantsByRole } from "./radiogroup.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect a tabs widget: a container with `role="tablist"` whose
 * descendants include `role="tab"` nodes. The currently selected tab
 * is identified via `aria-selected="true"` (propagated as `state.selected`).
 */
export function detectTabs(
  node: Node,
  _ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  if (node.role !== "tablist") return null;

  const tabs = collectDescendantsByRole(node, ctx, "tab");
  if (tabs.length === 0) return null;

  const items = tabs.map((t) => ({
    value: t.name ?? t.id,
    label: t.name ?? "",
    nodeId: t.id,
    ...(t.state.disabled ? { disabled: true } : {}),
  }));

  const selectedTab = tabs.find((t) => t.state.selected === true);
  const selected = selectedTab ? (selectedTab.name ?? selectedTab.id) : "";

  return {
    type: "tabs",
    nodeIds: [node.id, ...tabs.map((t) => t.id)],
    state: { selected, items },
    hints: {},
  };
}
