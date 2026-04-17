import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import { collectDescendantsByRole } from "./radiogroup.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect a checkboxgroup: a container with `role="group"` whose descendants
 * are predominantly `role="checkbox"`.
 *
 * Detection heuristic: the container is `role="group"` AND contains at least
 * two direct-or-nested descendants with `role="checkbox"`. Fieldsets with
 * mixed controls are rejected — this avoids mislabeling generic groups.
 */
export function detectCheckboxgroup(
  node: Node,
  _ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  if (node.role !== "group") return null;

  const checkboxes = collectDescendantsByRole(node, ctx, "checkbox");
  if (checkboxes.length < 2) return null;

  const otherControls = countOtherControls(node, ctx, checkboxes);
  if (otherControls > 0) return null;

  const options = checkboxes.map((c) => ({
    value: c.name ?? c.id,
    label: c.name ?? "",
    nodeId: c.id,
    ...(c.state.disabled ? { disabled: true } : {}),
  }));
  const values = checkboxes
    .filter((c) => c.state.checked === true)
    .map((c) => c.name ?? c.id);

  return {
    type: "checkboxgroup",
    nodeIds: [node.id, ...checkboxes.map((c) => c.id)],
    state: { values, options },
    hints: {},
  };
}

const CONTROL_ROLES = new Set([
  "button",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "radio",
  "slider",
  "switch",
  "spinbutton",
]);

function countOtherControls(
  root: Node,
  ctx: DetectContext,
  checkboxes: Node[],
): number {
  const checkboxIds = new Set(checkboxes.map((c) => c.id));
  let count = 0;
  const walk = (id: string) => {
    const n = ctx.byNodeId.get(id);
    if (!n) return;
    if (!checkboxIds.has(n.id) && CONTROL_ROLES.has(n.role)) count++;
    for (const cid of n.childIds) walk(cid);
  };
  for (const cid of root.childIds) walk(cid);
  return count;
}
