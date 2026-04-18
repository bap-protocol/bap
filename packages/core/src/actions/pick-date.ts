import type {
  ActionResult,
  BrowserState,
  PickDateAction,
} from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import {
  clearInput,
  type DispatchContext,
  focusElement,
  mouseClick,
  rectCenter,
  resolveNode,
  scrollIntoView,
  typeText,
} from "./cdp-helpers.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function dispatchPickDate(
  ctx: DispatchContext,
  action: PickDateAction,
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
  if (widget.type !== "datepicker" && widget.type !== "daterange-picker") {
    return errorResult(action.id, startedAt, {
      code: "widget-type-mismatch",
      message: `Widget is of type "${widget.type}", expected datepicker or daterange-picker`,
      retryable: false,
    });
  }

  try {
    if (widget.type === "datepicker") {
      if (typeof action.date !== "string" || !ISO_DATE.test(action.date)) {
        return errorResult(action.id, startedAt, {
          code: "invalid-value",
          message: `Expected ISO-8601 date (YYYY-MM-DD), got ${JSON.stringify(action.date)}`,
          retryable: false,
        });
      }
      await fillDateInput(ctx, state, widget.nodeIds[0]!, action.date);
    } else {
      if (
        typeof action.date !== "object" ||
        !ISO_DATE.test(action.date.start) ||
        !ISO_DATE.test(action.date.end)
      ) {
        return errorResult(action.id, startedAt, {
          code: "invalid-value",
          message: `Range picker expects { start, end } ISO-8601 dates`,
          retryable: false,
        });
      }
      const [, startNodeId, endNodeId] = widget.nodeIds;
      if (!startNodeId || !endNodeId) {
        return errorResult(action.id, startedAt, {
          code: "target-not-found",
          message: "Daterange widget is missing start/end input references",
          retryable: false,
        });
      }
      await fillDateInput(ctx, state, startNodeId, action.date.start);
      await fillDateInput(ctx, state, endNodeId, action.date.end);
    }

    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}

async function fillDateInput(
  ctx: DispatchContext,
  state: BrowserState,
  nodeId: string,
  iso: string,
): Promise<void> {
  const node = resolveNode(state, nodeId);
  if (!node) throw new Error(`Date input node ${nodeId} not found`);

  const backendNodeId = ctx.backendIdByNodeId.get(node.id);
  if (backendNodeId !== undefined) {
    // Native <input type="date"> takes the ISO string verbatim via its value
    // setter. This bypasses locale-dependent keyboard parsing.
    const resolved = await ctx.client.send("DOM.resolveNode", { backendNodeId });
    const objectId = resolved.object.objectId;
    if (objectId) {
      try {
        const res = await ctx.client.send("Runtime.callFunctionOn", {
          objectId,
          functionDeclaration: `function(iso){
            if (this.tagName === "INPUT" && (this.type === "date" || this.type === "text")) {
              this.value = iso;
              this.dispatchEvent(new Event("input", { bubbles: true }));
              this.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            }
            return false;
          }`,
          arguments: [{ value: iso }],
          returnByValue: true,
        });
        if (res.result.value === true) return;
      } finally {
        await ctx.client.send("Runtime.releaseObject", { objectId }).catch(() => {});
      }
    }
  }

  // Fallback: focus the element and type the ISO string.
  await scrollIntoView(ctx, node.id);
  const focused = await focusElement(ctx, node.id);
  if (!focused && node.rect) {
    await mouseClick(ctx.client, rectCenter(node.rect, state.viewport));
  }
  await clearInput(ctx);
  await typeText(ctx.client, iso);
}
