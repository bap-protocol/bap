import type { ActionResult, BrowserState, ScrollAction } from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import { type DispatchContext, resolveNode } from "./cdp-helpers.js";

export async function dispatchScroll(
  ctx: DispatchContext,
  action: ScrollAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();

  try {
    if (action.target) {
      const target = resolveNode(state, action.target.nodeId);
      if (!target) {
        return errorResult(action.id, startedAt, {
          code: "target-not-found",
          message: `Node ${action.target.nodeId} not found in the last snapshot`,
          retryable: false,
        });
      }
      const backendNodeId = ctx.backendIdByNodeId.get(target.id);
      if (backendNodeId === undefined) {
        return errorResult(action.id, startedAt, {
          code: "target-not-found",
          message: `Node ${action.target.nodeId} has no backend DOM id`,
          retryable: false,
        });
      }
      const expr = scrollExpression(action.to, true);
      await evaluateOnBackendNode(ctx, backendNodeId, expr);
    } else {
      const expr = scrollExpression(action.to, false);
      await ctx.client.send("Runtime.evaluate", { expression: expr });
    }

    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}

function scrollExpression(to: ScrollAction["to"], onElement: boolean): string {
  const self = onElement ? "this" : "window";
  const heightSrc = onElement ? "this.scrollHeight" : "document.documentElement.scrollHeight";
  if (to === "top") return `${self}.scrollTo({ top: 0, left: 0 })`;
  if (to === "bottom") return `${self}.scrollTo({ top: ${heightSrc}, left: 0 })`;
  if ("delta" in to) {
    return `${self}.scrollBy({ left: ${Number(to.delta.x)}, top: ${Number(to.delta.y)} })`;
  }
  return `${self}.scrollTo({ left: ${Number(to.x)}, top: ${Number(to.y)} })`;
}

async function evaluateOnBackendNode(
  ctx: DispatchContext,
  backendNodeId: number,
  body: string,
): Promise<void> {
  const resolved = await ctx.client.send("DOM.resolveNode", { backendNodeId });
  const objectId = resolved.object.objectId;
  if (!objectId) throw new Error("DOM.resolveNode returned no objectId");
  try {
    await ctx.client.send("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: `function(){ ${body} }`,
    });
  } finally {
    await ctx.client.send("Runtime.releaseObject", { objectId }).catch(() => {});
  }
}
