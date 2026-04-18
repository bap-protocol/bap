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
import type { DispatchContext } from "./cdp-helpers.js";

export async function dispatchAction(
  ctx: DispatchContext,
  action: Action,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  switch (action.type) {
    case "navigate":
      return dispatchNavigate(ctx, action);
    case "click":
      return dispatchClick(ctx, action, state);
    case "fill":
      return dispatchFill(ctx, action, state);
    case "slide":
      return dispatchSlide(ctx, action, state);
    case "scroll":
      return dispatchScroll(ctx, action, state);
    case "wait":
      return dispatchWait(ctx, action);
    case "upload":
      return dispatchUpload(ctx, action, state);
    case "select":
      return dispatchSelect(ctx, action, state);
    case "pick-date":
      return dispatchPickDate(ctx, action, state);
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
