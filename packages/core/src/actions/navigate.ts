import type { ActionResult, NavigateAction } from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import type { DispatchContext } from "./cdp-helpers.js";

export async function dispatchNavigate(
  ctx: DispatchContext,
  action: NavigateAction,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? 30_000;
  const waitUntil = action.waitUntil ?? "load";
  const eventName =
    waitUntil === "domcontentloaded"
      ? "Page.domContentEventFired"
      : waitUntil === "networkidle"
        ? "Page.lifecycleEvent"
        : "Page.loadEventFired";

  try {
    const done = new Promise<void>((resolve, reject) => {
      const off = ctx.client.on(
        eventName as "Page.loadEventFired",
        (payload) => {
          if (waitUntil === "networkidle") {
            const name = (payload as { name?: string }).name;
            if (name !== "networkIdle") return;
          }
          off();
          resolve();
        },
      );
      const handle = setTimeout(() => {
        off();
        reject(new Error(`navigate(${action.url}) timed out after ${timeout}ms`));
      }, timeout);
      handle.unref?.();
    });

    const navRes = await ctx.client.send("Page.navigate", { url: action.url });
    if (navRes.errorText) {
      return errorResult(action.id, startedAt, {
        code: "navigation-failed",
        message: navRes.errorText,
        retryable: false,
      });
    }
    await done;
    return successResult(action.id, startedAt);
  } catch (err) {
    const classified = classifyError(err);
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
