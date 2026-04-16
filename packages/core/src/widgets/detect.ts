import type { Node, Widget } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import { detectSlider } from "./slider.js";
import { detectCombobox } from "./combobox.js";

export type WidgetDraft = Omit<Widget, "id">;

/**
 * Detect widgets from a flattened node list plus the originating AX nodes.
 * Each widget packages a semantic group (e.g. slider with its value bounds)
 * that agents can target without re-deriving ARIA semantics.
 */
export function detectWidgets(
  nodes: Node[],
  byAxId: Map<string, CDPAXNode>,
): Widget[] {
  const widgets: Widget[] = [];
  let counter = 0;

  for (const node of nodes) {
    const ax = byAxId.get(node.id);
    if (!ax) continue;

    const draft = tryDetect(node, ax);
    if (draft) {
      widgets.push({ ...draft, id: `w${++counter}` });
    }
  }

  return widgets;
}

function tryDetect(node: Node, ax: CDPAXNode): WidgetDraft | null {
  return detectSlider(node, ax) ?? detectCombobox(node, ax) ?? null;
}
