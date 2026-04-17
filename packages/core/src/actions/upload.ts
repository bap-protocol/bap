import type { Page } from "playwright";
import type {
  ActionResult,
  BrowserState,
  NodeRef,
  UploadAction,
  WidgetRef,
} from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

function isWidgetRef(ref: NodeRef | WidgetRef): ref is WidgetRef {
  return "widgetId" in ref;
}

const DEFAULT_TIMEOUT = 10_000;

export async function dispatchUpload(
  page: Page,
  action: UploadAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  const anchorNodeId = resolveAnchorNodeId(action, state);
  if (!anchorNodeId) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Upload target could not be resolved`,
      retryable: false,
    });
  }
  const anchor = state.nodes.find((n) => n.id === anchorNodeId);
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

  try {
    const role = anchor.role as Parameters<Page["getByRole"]>[0];
    const locator = anchor.name
      ? page.getByRole(role, { name: anchor.name, exact: true })
      : page.getByRole(role);
    await locator.first().setInputFiles(action.files, { timeout });

    const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
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
