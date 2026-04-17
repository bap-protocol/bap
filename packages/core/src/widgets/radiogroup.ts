import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DetectContext, WidgetDraft } from "./detect.js";

/**
 * Detect a radiogroup: a container with `role="radiogroup"` whose descendant
 * tree contains `role="radio"` nodes.
 *
 * v0.1 scope: only explicit `role="radiogroup"` containers are detected.
 * Native `<fieldset>` groupings of radios (role="group") are deferred.
 */
export function detectRadiogroup(
  node: Node,
  _ax: CDPAXNode,
  ctx: DetectContext,
): WidgetDraft | null {
  if (node.role !== "radiogroup") return null;

  const radios = collectDescendantsByRole(node, ctx, "radio");
  const options = radios.map((r) => ({
    value: r.name ?? r.id,
    label: r.name ?? "",
    nodeId: r.id,
    ...(r.state.disabled ? { disabled: true } : {}),
  }));
  const checked = radios.find((r) => r.state.checked === true);
  const value = checked ? (checked.name ?? checked.id) : null;

  return {
    type: "radiogroup",
    nodeIds: [node.id, ...radios.map((r) => r.id)],
    state: { value, options },
    hints: {},
  };
}

export function collectDescendantsByRole(
  root: Node,
  ctx: DetectContext,
  role: string,
): Node[] {
  const out: Node[] = [];
  const walk = (id: string) => {
    const n = ctx.byNodeId.get(id);
    if (!n) return;
    if (n.role === role) {
      out.push(n);
      return;
    }
    for (const cid of n.childIds) walk(cid);
  };
  for (const cid of root.childIds) walk(cid);
  return out;
}
