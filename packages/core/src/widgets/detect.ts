import type { Node, Widget } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import { detectSlider } from "./slider.js";

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
  const nextId = () => `w${++counter}`;

  for (const node of nodes) {
    const ax = byAxId.get(node.id);
    if (!ax) continue;

    const slider = detectSlider(nextId(), node, ax);
    if (slider) {
      widgets.push(slider);
      continue;
    }
    // Reclaim counter when no widget was produced — keep IDs dense.
    counter--;
  }

  return widgets;
}
