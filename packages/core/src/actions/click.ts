import type { Page } from "playwright";
import type { ActionResult, BrowserState, ClickAction } from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 5_000;

export async function dispatchClick(
  page: Page,
  action: ClickAction,
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

  try {
    const role = target.role as Parameters<Page["getByRole"]>[0];
    const locator = target.name
      ? page.getByRole(role, { name: target.name, exact: true })
      : page.getByRole(role);

    const clickCount = action.clickCount ?? 1;
    const button = action.button ?? "left";
    const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

    await locator.first().click({ clickCount, button, timeout });

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
