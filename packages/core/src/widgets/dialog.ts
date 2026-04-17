import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { WidgetDraft } from "./detect.js";

/**
 * Detect a dialog. An `alertdialog` is treated as an implicitly modal
 * dialog. Presence in the AX tree implies `open: true`; closed dialogs
 * (display: none) are elided from the tree.
 */
export function detectDialog(node: Node, ax: CDPAXNode): WidgetDraft | null {
  if (node.role !== "dialog" && node.role !== "alertdialog") return null;

  const modalProp = (ax.properties ?? []).find((p) => p.name === "modal");
  const modal = coerceBool(modalProp?.value.value) === true || node.role === "alertdialog";
  const state: Record<string, unknown> = { open: true, modal };
  if (node.name) state.title = node.name;

  return { type: "dialog", nodeIds: [node.id], state, hints: {} };
}

function coerceBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}
