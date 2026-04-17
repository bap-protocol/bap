import type { Page } from "playwright";
import type {
  ActionResult,
  BrowserState,
  PickDateAction,
} from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 5_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function dispatchPickDate(
  page: Page,
  action: PickDateAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  const widget = state.widgets.find((w) => w.id === action.target.widgetId);
  if (!widget) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Widget ${action.target.widgetId} not found in the last snapshot`,
      retryable: false,
    });
  }
  if (widget.type !== "datepicker" && widget.type !== "daterange-picker") {
    return errorResult(action.id, startedAt, {
      code: "widget-type-mismatch",
      message: `Widget is of type "${widget.type}", expected datepicker or daterange-picker`,
      retryable: false,
    });
  }

  try {
    if (widget.type === "datepicker") {
      if (typeof action.date !== "string" || !ISO_DATE.test(action.date)) {
        return errorResult(action.id, startedAt, {
          code: "invalid-value",
          message: `Expected ISO-8601 date (YYYY-MM-DD), got ${JSON.stringify(action.date)}`,
          retryable: false,
        });
      }
      await fillDateInput(page, state, widget.nodeIds[0]!, action.date, timeout);
    } else {
      if (
        typeof action.date !== "object" ||
        !ISO_DATE.test(action.date.start) ||
        !ISO_DATE.test(action.date.end)
      ) {
        return errorResult(action.id, startedAt, {
          code: "invalid-value",
          message: `Range picker expects { start, end } ISO-8601 dates`,
          retryable: false,
        });
      }
      const [, startNodeId, endNodeId] = widget.nodeIds;
      if (!startNodeId || !endNodeId) {
        return errorResult(action.id, startedAt, {
          code: "target-not-found",
          message: "Daterange widget is missing start/end input references",
          retryable: false,
        });
      }
      await fillDateInput(page, state, startNodeId, action.date.start, timeout);
      await fillDateInput(page, state, endNodeId, action.date.end, timeout);
    }

    const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
  }
}

async function fillDateInput(
  page: Page,
  state: BrowserState,
  nodeId: string,
  iso: string,
  timeout: number,
): Promise<void> {
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Date input node ${nodeId} not found`);
  // Chromium exposes <input type="date"> with AX role "date", which is not
  // a standard ARIA role Playwright's getByRole understands. Resolve the
  // element by its accessible label instead.
  const locator = node.name
    ? page.getByLabel(node.name, { exact: true })
    : page.locator('input[type="date"]');
  await locator.first().fill(iso, { timeout });
}
