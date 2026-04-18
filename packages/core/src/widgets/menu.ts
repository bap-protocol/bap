import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

const MENUITEM_ROLES = new Set(["menuitem", "menuitemcheckbox", "menuitemradio"]);

/**
 * Detect a menu: a container with `role="menu"` whose descendants are
 * menu items. Presence in the AX tree implies `open: true` — closed
 * popup menus are elided. Top-level navigation bars (`role="menubar"`)
 * are a separate pattern deferred to v0.2.
 */
export function detectMenu(
  node: Node,
  _ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  if (node.role !== "menu") return null;

  const items = collectMenuItems(node, ctx);
  const state: Record<string, unknown> = { open: true };
  if (items.length > 0) {
    state.items = items.map((i) => {
      const entry: Record<string, unknown> = { label: i.name ?? "", nodeId: i.id };
      if (i.state.disabled) entry.disabled = true;
      return entry;
    });
  }

  return {
    type: "menu",
    nodeIds: [node.id, ...items.map((i) => i.id)],
    state,
    hints: { openTrigger: "click" },
  };
}

function collectMenuItems(root: Node, ctx: DetectContext): Node[] {
  const out: Node[] = [];
  const walk = (id: string) => {
    const n = ctx.byNodeId.get(id);
    if (!n) return;
    if (MENUITEM_ROLES.has(n.role)) {
      out.push(n);
      return;
    }
    for (const cid of n.childIds) walk(cid);
  };
  for (const cid of root.childIds) walk(cid);
  return out;
}
