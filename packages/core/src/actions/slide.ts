import type { Page } from "playwright";
import type { ActionResult, BrowserState, SlideAction, SliderState } from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 5_000;

export async function dispatchSlide(
  page: Page,
  action: SlideAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();

  const widget = state.widgets.find((w) => w.id === action.target.widgetId);
  if (!widget) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Widget ${action.target.widgetId} not found in the last snapshot`,
      retryable: false,
    });
  }
  if (widget.type !== "slider") {
    return errorResult(action.id, startedAt, {
      code: "widget-type-mismatch",
      message: `Widget is of type "${widget.type}", expected "slider"`,
      retryable: false,
    });
  }

  if (Array.isArray(action.value)) {
    return errorResult(action.id, startedAt, {
      code: "invalid-value",
      message: "Range slider targets are not supported in v0.1 of @bap-protocol/core",
      retryable: false,
    });
  }

  const sliderState = widget.state as unknown as SliderState;
  const currentValue = Array.isArray(sliderState.value) ? sliderState.value[0] : sliderState.value;
  if (currentValue === undefined) {
    return errorResult(action.id, startedAt, {
      code: "invalid-value",
      message: "Slider widget has no current value",
      retryable: false,
    });
  }

  const targetValue = action.value;
  if (targetValue < sliderState.min || targetValue > sliderState.max) {
    return errorResult(action.id, startedAt, {
      code: "invalid-value",
      message: `Target ${targetValue} is outside slider range [${sliderState.min}, ${sliderState.max}]`,
      retryable: false,
    });
  }

  const delta = targetValue - currentValue;
  if (delta === 0) return success(action.id, startedAt);

  const anchorId = widget.nodeIds[0];
  const anchor = anchorId ? state.nodes.find((n) => n.id === anchorId) : undefined;
  if (!anchor) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: "Slider anchor node not found",
      retryable: false,
    });
  }

  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  try {
    const role = anchor.role as Parameters<Page["getByRole"]>[0];
    const locator = anchor.name
      ? page.getByRole(role, { name: anchor.name, exact: true })
      : page.getByRole(role);
    const first = locator.first();

    await first.focus({ timeout });

    const step = sliderState.step ?? 1;
    const presses = Math.round(Math.abs(delta) / step);
    const key = delta > 0 ? "ArrowRight" : "ArrowLeft";
    for (let i = 0; i < presses; i++) {
      await first.press(key, { timeout });
    }

    return success(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
  }
}

function success(id: string | undefined, startedAt: number): ActionResult {
  const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
  if (id !== undefined) result.id = id;
  return result;
}
