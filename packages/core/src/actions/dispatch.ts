import type { Page } from "playwright";
import type { Action, ActionResult, BrowserState } from "@bap-protocol/spec";
import { dispatchClick } from "./click.js";
import { dispatchFill } from "./fill.js";
import { dispatchSlide } from "./slide.js";
import { dispatchScroll } from "./scroll.js";
import { dispatchWait } from "./wait.js";
import { dispatchUpload } from "./upload.js";
import { dispatchSelect } from "./select.js";
import { dispatchPickDate } from "./pick-date.js";
import { dispatchNavigate } from "./navigate.js";
import { errorResult } from "./errors.js";

export async function dispatchAction(
  page: Page,
  action: Action,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  switch (action.type) {
    case "navigate":
      return dispatchNavigate(page, action);
    case "click":
      return dispatchClick(page, action, state);
    case "fill":
      return dispatchFill(page, action, state);
    case "slide":
      return dispatchSlide(page, action, state);
    case "scroll":
      return dispatchScroll(page, action, state);
    case "wait":
      return dispatchWait(page, action);
    case "upload":
      return dispatchUpload(page, action, state);
    case "select":
      return dispatchSelect(page, action, state);
    case "pick-date":
      return dispatchPickDate(page, action, state);
    default: {
      // Defensive: reachable only if a caller bypasses the Action type (e.g.
      // JSON from an external source that didn't go through schema validation).
      const raw = action as { id?: string; type?: string };
      return errorResult(raw.id, startedAt, {
        code: "unknown",
        message: `Unknown action type "${raw.type ?? "<missing>"}"`,
        retryable: false,
      });
    }
  }
}
