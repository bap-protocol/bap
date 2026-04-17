import type { Page } from "playwright";
import type { ActionResult, NavigateAction } from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 30_000;

export async function dispatchNavigate(page: Page, action: NavigateAction): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  try {
    await page.goto(action.url, { waitUntil: action.waitUntil ?? "load", timeout });
    const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    const classified = classifyPlaywrightError(err);
    if (classified.code === "unknown") {
      return errorResult(action.id, startedAt, {
        code: "navigation-failed",
        message: classified.message,
        retryable: false,
      });
    }
    return errorResult(action.id, startedAt, classified);
  }
}
