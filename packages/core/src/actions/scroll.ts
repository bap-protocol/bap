import type { Page } from "playwright";
import type { ActionResult, BrowserState, ScrollAction } from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 5_000;

export async function dispatchScroll(
  page: Page,
  action: ScrollAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  try {
    if (action.target) {
      const target = state.nodes.find((n) => n.id === action.target!.nodeId);
      if (!target) {
        return errorResult(action.id, startedAt, {
          code: "target-not-found",
          message: `Node ${action.target.nodeId} not found in the last snapshot`,
          retryable: false,
        });
      }
      const role = target.role as Parameters<Page["getByRole"]>[0];
      const locator = target.name
        ? page.getByRole(role, { name: target.name, exact: true })
        : page.getByRole(role);
      const first = locator.first();

      if (action.to === "top" || action.to === "bottom") {
        await first.evaluate(
          (el, to) => {
            (el as HTMLElement).scrollTo({ top: to === "bottom" ? (el as HTMLElement).scrollHeight : 0, left: 0 });
          },
          action.to,
          { timeout },
        );
      } else if ("delta" in action.to) {
        const { delta } = action.to;
        await first.evaluate(
          (el, d) => {
            (el as HTMLElement).scrollBy({ left: d.x, top: d.y });
          },
          delta,
          { timeout },
        );
      } else {
        const { x, y } = action.to;
        await first.evaluate(
          (el, c) => {
            (el as HTMLElement).scrollTo({ left: c.x, top: c.y });
          },
          { x, y },
          { timeout },
        );
      }
    } else {
      if (action.to === "top" || action.to === "bottom") {
        await page.evaluate((to) => {
          window.scrollTo({ top: to === "bottom" ? document.documentElement.scrollHeight : 0, left: 0 });
        }, action.to);
      } else if ("delta" in action.to) {
        const { delta } = action.to;
        await page.evaluate((d) => {
          window.scrollBy({ left: d.x, top: d.y });
        }, delta);
      } else {
        const { x, y } = action.to;
        await page.evaluate((c) => {
          window.scrollTo({ left: c.x, top: c.y });
        }, { x, y });
      }
    }

    const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
  }
}
