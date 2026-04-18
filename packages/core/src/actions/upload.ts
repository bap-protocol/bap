import type {
  ActionResult,
  BrowserState,
  NodeRef,
  UploadAction,
  WidgetRef,
} from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import { type DispatchContext, resolveNode } from "./cdp-helpers.js";

function isWidgetRef(ref: NodeRef | WidgetRef): ref is WidgetRef {
  return "widgetId" in ref;
}

export async function dispatchUpload(
  ctx: DispatchContext,
  action: UploadAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();

  const anchorNodeId = resolveAnchorNodeId(action, state);
  if (!anchorNodeId) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Upload target could not be resolved`,
      retryable: false,
    });
  }
  const anchor = resolveNode(state, anchorNodeId);
  if (!anchor) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Node ${anchorNodeId} not found in the last snapshot`,
      retryable: false,
    });
  }

  if (action.files.length === 0) {
    return errorResult(action.id, startedAt, {
      code: "invalid-value",
      message: "Upload action requires at least one file path",
      retryable: false,
    });
  }

  const backendNodeId = ctx.backendIdByNodeId.get(anchor.id);
  if (backendNodeId === undefined) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Node ${anchorNodeId} has no backend DOM id`,
      retryable: false,
    });
  }

  try {
    await ctx.client.send("DOM.setFileInputFiles", {
      files: action.files,
      backendNodeId,
    });
    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}

function resolveAnchorNodeId(action: UploadAction, state: BrowserState): string | null {
  const target = action.target;
  if (isWidgetRef(target)) {
    const widget = state.widgets.find((w) => w.id === target.widgetId);
    if (!widget || widget.type !== "fileupload") return null;
    return widget.nodeIds[0] ?? null;
  }
  return target.nodeId;
}
