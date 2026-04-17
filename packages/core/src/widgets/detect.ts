import type { Node, Widget } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { DOMMeta } from "../state/dom-meta.js";
import { detectSlider } from "./slider.js";
import { detectStepper } from "./stepper.js";
import { detectCombobox } from "./combobox.js";
import { detectRadiogroup } from "./radiogroup.js";
import { detectCheckboxgroup } from "./checkboxgroup.js";
import { detectToggleswitch } from "./toggleswitch.js";
import { detectFileupload } from "./fileupload.js";
import { detectDaterangePicker } from "./daterange-picker.js";
import { detectDatepicker } from "./datepicker.js";
import { detectDialog } from "./dialog.js";

export type WidgetDraft = Omit<Widget, "id">;

export interface DetectContext {
  nodes: Node[];
  byAxId: Map<string, CDPAXNode>;
  byNodeId: Map<string, Node>;
  domByBackendId: Map<number, DOMMeta>;
}

/**
 * Detect widgets from a flattened node list plus the originating AX nodes.
 * A node belongs to at most one widget (RFC 0003): once a composite widget
 * (e.g. daterange-picker) claims its constituent nodes, the per-node
 * detectors skip them on subsequent iterations.
 */
export function detectWidgets(
  nodes: Node[],
  byAxId: Map<string, CDPAXNode>,
  domByBackendId: Map<number, DOMMeta> = new Map(),
): Widget[] {
  const byNodeId = new Map(nodes.map((n) => [n.id, n]));
  const ctx: DetectContext = { nodes, byAxId, byNodeId, domByBackendId };

  const widgets: Widget[] = [];
  const claimed = new Set<string>();
  let counter = 0;

  for (const node of nodes) {
    if (claimed.has(node.id)) continue;
    const ax = byAxId.get(node.id);
    if (!ax) continue;

    const draft = tryDetect(node, ax, ctx);
    if (draft) {
      for (const nid of draft.nodeIds) claimed.add(nid);
      widgets.push({ ...draft, id: `w${++counter}` });
    }
  }

  return widgets;
}

function tryDetect(node: Node, ax: CDPAXNode, ctx: DetectContext): WidgetDraft | null {
  // Composite widgets (daterange, radiogroup, checkboxgroup) run first so
  // they can claim their constituent nodes before the single-node detectors
  // reach them.
  return (
    detectDaterangePicker(node, ax, ctx) ??
    detectRadiogroup(node, ax, ctx) ??
    detectCheckboxgroup(node, ax, ctx) ??
    detectSlider(node, ax) ??
    detectStepper(node, ax) ??
    detectCombobox(node, ax) ??
    detectToggleswitch(node, ax) ??
    detectFileupload(node, ax, ctx) ??
    detectDatepicker(node, ax, ctx) ??
    detectDialog(node, ax) ??
    null
  );
}
