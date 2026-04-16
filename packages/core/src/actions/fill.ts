import type { Page } from "playwright";
import type { ActionResult, BrowserState, FillAction } from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 5_000;

export async function dispatchFill(
  page: Page,
  action: FillAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const target = state.nodes.find((n) => n.id === action.target.nodeId);
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

  try {
    const role = target.role as Parameters<Page["getByRole"]>[0];
    const locator = target.name
      ? page.getByRole(role, { name: target.name, exact: true })
      : page.getByRole(role);

    const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;
    const first = locator.first();

    if (action.clear === false) {
      await first.focus({ timeout });
      await first.pressSequentially(action.value, { timeout });
    } else {
      await first.fill(action.value, { timeout });
    }

    if (action.submit) {
      await first.press("Enter", { timeout });
    }

    const result: ActionResult = {
      success: true,
      durationMs: Date.now() - startedAt,
    };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
  }
}
