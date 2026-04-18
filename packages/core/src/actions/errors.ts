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

export function classifyError(err: unknown): ActionError {
  const message = err instanceof Error ? err.message : String(err);
  if (/timed out|timeout/i.test(message)) return { code: "timeout", message, retryable: true };
  if (/not visible|not attached|hidden|detached/i.test(message))
    return { code: "target-hidden", message, retryable: true };
  if (/not stable|intercept/i.test(message))
    return { code: "target-not-interactable", message, retryable: true };
  if (/not an <input>|not an editable|not editable/i.test(message))
    return { code: "target-not-interactable", message, retryable: false };
  return { code: "unknown", message, retryable: false };
}

export function successResult(id: string | undefined, startedAt: number): ActionResult {
  const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
  if (id !== undefined) result.id = id;
  return result;
}
