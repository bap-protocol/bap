import type {
  ActionResult,
  BrowserState,
  Node,
  NodeRef,
  SelectAction,
  WidgetRef,
} from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import {
  type DispatchContext,
  mouseClick,
  rectCenter,
  resolveNode,
  scrollIntoView,
} from "./cdp-helpers.js";

function isWidgetRef(ref: NodeRef | WidgetRef): ref is WidgetRef {
  return "widgetId" in ref;
}

const DEFAULT_TIMEOUT = 5_000;
const POLL_INTERVAL = 50;

export async function dispatchSelect(
  ctx: DispatchContext,
  action: SelectAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  const anchor = resolveAnchor(action, state);
  if (!anchor) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Select target not found in the last snapshot`,
      retryable: false,
    });
  }
  if (action.values.length === 0) {
    return errorResult(action.id, startedAt, {
      code: "invalid-value",
      message: "Select requires at least one value",
      retryable: false,
    });
  }
  if (!anchor.rect) {
    return errorResult(action.id, startedAt, {
      code: "target-hidden",
      message: `Select anchor has no layout rect`,
      retryable: true,
    });
  }

  try {
    await scrollIntoView(ctx, anchor.id);
    const backendNodeId = ctx.backendIdByNodeId.get(anchor.id);
    const isNative = backendNodeId !== undefined && (await isNativeSelect(ctx, backendNodeId));

    if (isNative) {
      await selectNative(ctx, backendNodeId!, action.values);
    } else {
      await mouseClick(ctx.client, rectCenter(anchor.rect, state.viewport));
      for (const value of action.values) {
        await clickOptionByName(ctx, value, timeout);
      }
    }

    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}

function resolveAnchor(action: SelectAction, state: BrowserState): Node | null {
  const target = action.target;
  if (isWidgetRef(target)) {
    const widget = state.widgets.find((w) => w.id === target.widgetId);
    if (!widget) return null;
    if (widget.type !== "combobox" && widget.type !== "listbox") return null;
    const nodeId = widget.nodeIds[0];
    if (!nodeId) return null;
    return resolveNode(state, nodeId) ?? null;
  }
  return resolveNode(state, target.nodeId) ?? null;
}

async function isNativeSelect(ctx: DispatchContext, backendNodeId: number): Promise<boolean> {
  try {
    const resolved = await ctx.client.send("DOM.resolveNode", { backendNodeId });
    const objectId = resolved.object.objectId;
    if (!objectId) return false;
    const res = await ctx.client.send("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: "function(){ return this.tagName === 'SELECT'; }",
      returnByValue: true,
    });
    await ctx.client.send("Runtime.releaseObject", { objectId }).catch(() => {});
    return res.result.value === true;
  } catch {
    return false;
  }
}

async function selectNative(
  ctx: DispatchContext,
  backendNodeId: number,
  values: string[],
): Promise<void> {
  const resolved = await ctx.client.send("DOM.resolveNode", { backendNodeId });
  const objectId = resolved.object.objectId;
  if (!objectId) throw new Error("Could not resolve <select> element");
  try {
    await ctx.client.send("Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: `function(values){
        const set = new Set(values);
        for (const opt of this.options) opt.selected = set.has(opt.value) || set.has(opt.label);
        this.dispatchEvent(new Event("input", { bubbles: true }));
        this.dispatchEvent(new Event("change", { bubbles: true }));
      }`,
      arguments: [{ value: values }],
    });
  } finally {
    await ctx.client.send("Runtime.releaseObject", { objectId }).catch(() => {});
  }
}

async function clickOptionByName(
  ctx: DispatchContext,
  name: string,
  timeout: number,
): Promise<void> {
  const deadline = Date.now() + timeout;
  const expr = `(() => {
    const want = ${JSON.stringify(name)};
    const els = Array.from(document.querySelectorAll('[role="option"]'));
    const match = els.find((el) => (el.getAttribute("aria-label") || el.textContent || "").trim() === want);
    if (!match) return null;
    const r = match.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`;

  while (Date.now() < deadline) {
    const res = await ctx.client.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
    });
    const point = res.result.value as { x: number; y: number } | null;
    if (point) {
      await mouseClick(ctx.client, point);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Timed out waiting for option "${name}"`);
}
