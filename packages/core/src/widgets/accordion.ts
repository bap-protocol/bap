import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect an accordion: a container whose direct or near-direct descendants
 * include at least two sibling `button` nodes with `aria-expanded` set
 * (propagated as `state.expanded`).
 *
 * There is no canonical ARIA role for "accordion" — the pattern is
 * defined behaviorally. This detector uses the WAI-ARIA Authoring
 * Practices guideline: an accordion is "a vertically stacked set of
 * interactive headings that each enable users to reveal or hide their
 * associated sections."
 *
 * v0.1 heuristic is narrow on purpose:
 * - The candidate container must hold at least 2 descendant buttons.
 * - Each button must have `state.expanded` set (true or false).
 * - The container must not itself be a menu, dialog, or toolbar to
 *   avoid false positives from unrelated expand controls.
 */
export function detectAccordion(
  node: Node,
  _ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  if (node.role === "menu" || node.role === "dialog" || node.role === "alertdialog") return null;
  if (node.role === "menubar" || node.role === "toolbar") return null;

  const buttons = collectExpandableButtons(node, ctx);
  if (buttons.length < 2) return null;

  const items = buttons.map((b) => ({
    value: b.name ?? b.id,
    label: b.name ?? "",
    nodeId: b.id,
    ...(b.state.disabled ? { disabled: true } : {}),
  }));
  const expanded = buttons
    .filter((b) => b.state.expanded === true)
    .map((b) => b.name ?? b.id);

  return {
    type: "accordion",
    nodeIds: [node.id, ...buttons.map((b) => b.id)],
    state: { expanded, items },
    hints: {},
  };
}

function collectExpandableButtons(root: Node, ctx: DetectContext): Node[] {
  const out: Node[] = [];
  const walk = (id: string, depth: number) => {
    const n = ctx.byNodeId.get(id);
    if (!n) return;
    // Cap descent to avoid matching a whole page as one accordion.
    if (depth > 4) return;
    if (n.role === "button" && n.state.expanded !== undefined) {
      out.push(n);
      return;
    }
    for (const cid of n.childIds) walk(cid, depth + 1);
  };
  for (const cid of root.childIds) walk(cid, 1);
  return out;
}
