import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { WidgetDraft } from "./detect.js";

/**
 * Detect an ARIA combobox or listbox. Both share the same state shape per
 * RFC 0003; only the widget type tag differs.
 *
 * v0.1 scope: captures role, value, multi-selectable, open state.
 * Options discovery (the list of selectable values) is deferred — comboboxes
 * in real UIs often portal their listbox into a separate DOM subtree, and
 * resolving that cross-tree relationship requires `aria-controls` handling
 * that will come in v0.2.
 */
export function detectCombobox(node: Node, ax: CDPAXNode): WidgetDraft | null {
  const type = node.role === "combobox" ? "combobox" : node.role === "listbox" ? "listbox" : null;
  if (!type) return null;

  const multi = boolProp(ax, "multiselectable");
  const open = node.state.expanded === true;
  const value = node.value ?? "";

  return {
    type,
    nodeIds: [node.id],
    state: { value, multi, open },
    hints: {
      searchable: type === "combobox",
      optionsPopulatedOn: "always",
      freeText: false,
    },
  };
}

function boolProp(ax: CDPAXNode, name: string): boolean {
  const raw = (ax.properties ?? []).find((p) => p.name === name)?.value.value;
  return raw === true;
}
