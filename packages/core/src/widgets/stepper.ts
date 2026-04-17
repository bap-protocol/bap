import type { Node } from "@bap-protocol/spec";
import type { CDPAXNode } from "../state/accessibility.js";
import type { WidgetDraft } from "./detect.js";

/**
 * Detect a stepper (number-input-with-bounds). Both native
 * `<input type="number">` and custom ARIA widgets with
 * `role="spinbutton"` surface as the same role in the A11y tree,
 * so a single detector covers both.
 *
 * Guest-count pickers, quantity selectors, numeric filter fields —
 * ubiquitous on booking and e-commerce flows. v0.1 detects the
 * semantic spinbutton; paired `+`/`-` buttons (common on custom
 * steppers that use role="button" surfaces instead of spinbutton)
 * are a v0.2 detection target.
 */
export function detectStepper(node: Node, ax: CDPAXNode): WidgetDraft | null {
  if (node.role !== "spinbutton") return null;

  const value = coerceNumber(ax.value?.value);
  if (value === undefined) return null;

  const state: Record<string, unknown> = { value };
  const min = numberProp(ax, "valuemin");
  const max = numberProp(ax, "valuemax");
  if (min !== undefined) state.min = min;
  if (max !== undefined) state.max = max;

  return {
    type: "stepper",
    nodeIds: [node.id],
    state,
    hints: {
      fillStrategies: ["fill-value", "keyboard"],
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
