import type { ActionResult, BrowserState, FillAction } from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import {
  clearInput,
  type DispatchContext,
  focusElement,
  mouseClick,
  pressKey,
  rectCenter,
  resolveNode,
  scrollIntoView,
  typeText,
} from "./cdp-helpers.js";

export async function dispatchFill(
  ctx: DispatchContext,
  action: FillAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const target = resolveNode(state, action.target.nodeId);
  if (!target) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Node ${action.target.nodeId} not found in the last snapshot`,
      retryable: false,
    });
  }
  if (!target.editable) {
    return errorResult(action.id, startedAt, {
      code: "target-not-interactable",
      message: `Node ${action.target.nodeId} (role=${target.role}) is not editable`,
      retryable: false,
    });
  }
  if (!target.rect) {
    return errorResult(action.id, startedAt, {
      code: "target-hidden",
      message: `Node ${action.target.nodeId} has no layout rect`,
      retryable: true,
    });
  }

  try {
    await scrollIntoView(ctx, target.id);
    const focused = await focusElement(ctx, target.id);
    if (!focused) {
      await mouseClick(ctx.client, rectCenter(target.rect, state.viewport));
    }

    if (action.clear !== false) {
      await clearInput(ctx);
    }
    if (action.value.length > 0) {
      await typeText(ctx.client, action.value);
    }

    if (action.submit) {
      await pressKey(ctx.client, "Enter");
    }

    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}
