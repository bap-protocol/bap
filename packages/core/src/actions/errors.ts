import type { ActionError, ActionResult } from "@bap-protocol/spec";

export function errorResult(
  id: string | undefined,
  startedAt: number,
  error: ActionError,
): ActionResult {
  const result: ActionResult = {
    success: false,
    error,
    durationMs: Date.now() - startedAt,
  };
  if (id !== undefined) result.id = id;
  return result;
}

export function classifyPlaywrightError(err: unknown): ActionError {
  const message = err instanceof Error ? err.message : String(err);
  if (/Timeout/i.test(message)) return { code: "timeout", message, retryable: true };
  if (/not visible|not attached|hidden/i.test(message))
    return { code: "target-hidden", message, retryable: true };
  if (/not stable|intercept/i.test(message))
    return { code: "target-not-interactable", message, retryable: true };
  if (/not an <input>|not an editable|not editable/i.test(message))
    return { code: "target-not-interactable", message, retryable: false };
  return { code: "unknown", message, retryable: false };
}
