import type { Page } from "playwright";
import type { Action, ActionResult, BrowserState } from "@bap-protocol/spec";
import { dispatchClick } from "./click.js";
import { dispatchFill } from "./fill.js";
import { dispatchSlide } from "./slide.js";
import { errorResult } from "./errors.js";

export async function dispatchAction(
  page: Page,
  action: Action,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  switch (action.type) {
    case "click":
      return dispatchClick(page, action, state);
    case "fill":
      return dispatchFill(page, action, state);
    case "slide":
      return dispatchSlide(page, action, state);
    default:
      return errorResult(action.id, startedAt, {
        code: "unknown",
        message: `Action type "${action.type}" is not implemented in v0.1 of @bap-protocol/core`,
        retryable: false,
      });
  }
}
