import type { ActionResult, BrowserState, ClickAction } from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import {
  type DispatchContext,
  mouseClick,
  rectCenter,
  resolveNode,
  scrollIntoView,
} from "./cdp-helpers.js";

export async function dispatchClick(
  ctx: DispatchContext,
  action: ClickAction,
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
  if (!target.rect) {
    return errorResult(action.id, startedAt, {
      code: "target-hidden",
      message: `Node ${action.target.nodeId} has no layout rect`,
      retryable: true,
    });
  }

  try {
    await scrollIntoView(ctx, target.id);
    const point = rectCenter(target.rect, state.viewport);
    await mouseClick(ctx.client, point, {
      button: action.button ?? "left",
      clickCount: action.clickCount ?? 1,
    });
    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}
