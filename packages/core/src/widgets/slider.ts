import type { Node, Widget } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";

export function detectSlider(id: string, node: Node, ax: CDPAXNode): Widget | null {
  if (node.role !== "slider") return null;

  const min = numberProp(ax, "valuemin");
  const max = numberProp(ax, "valuemax");
  if (min === undefined || max === undefined) return null;

  // Current value lives on AXNode.value itself — "valuenow" is not in CDP's
  // AXProperty enum (only valuemin/valuemax/valuetext are).
  const value = coerceNumber(ax.value?.value) ?? min;

  const state: Record<string, unknown> = { min, max, value };
  if (node.rect && node.rect.height > node.rect.width) {
    state.orientation = "vertical";
  }

  return {
    id,
    type: "slider",
    nodeIds: [node.id],
    state,
    hints: {
      fillStrategies: ["aria-valuenow", "keyboard", "drag"],
      thumbNodeIds: [node.id],
    },
  };
}

function numberProp(ax: CDPAXNode, name: string): number | undefined {
  const raw = (ax.properties ?? []).find((p) => p.name === name)?.value.value;
  return coerceNumber(raw);
}

function coerceNumber(raw: unknown): number | undefined {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
