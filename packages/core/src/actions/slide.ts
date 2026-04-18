import type { ActionResult, BrowserState, SlideAction, SliderState } from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import {
  type DispatchContext,
  focusElement,
  mouseClick,
  pressKey,
  rectCenter,
  resolveNode,
  scrollIntoView,
} from "./cdp-helpers.js";

export async function dispatchSlide(
  ctx: DispatchContext,
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
  if (delta === 0) return successResult(action.id, startedAt);

  const anchorId = widget.nodeIds[0];
  const anchor = anchorId ? resolveNode(state, anchorId) : undefined;
  if (!anchor || !anchor.rect) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: "Slider anchor node not found or has no rect",
      retryable: false,
    });
  }

  try {
    await scrollIntoView(ctx, anchor.id);
    const focused = await focusElement(ctx, anchor.id);
    if (!focused) {
      // DOM.focus failed (e.g. missing backend id); fall back to a click —
      // but note that clicking the slider track itself will jump the thumb
      // to the click position.
      await mouseClick(ctx.client, rectCenter(anchor.rect, state.viewport));
    }

    const step = sliderState.step ?? 1;
    const presses = Math.round(Math.abs(delta) / step);
    const key = delta > 0 ? "ArrowRight" : "ArrowLeft";
    for (let i = 0; i < presses; i++) {
      await pressKey(ctx.client, key);
    }

    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}
