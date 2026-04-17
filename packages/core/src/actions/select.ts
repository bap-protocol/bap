import type { Locator as PWLocator, Page } from "playwright";
import type {
  ActionResult,
  BrowserState,
  Node,
  NodeRef,
  SelectAction,
  WidgetRef,
} from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

function isWidgetRef(ref: NodeRef | WidgetRef): ref is WidgetRef {
  return "widgetId" in ref;
}

const DEFAULT_TIMEOUT = 5_000;

export async function dispatchSelect(
  page: Page,
  action: SelectAction,
  state: BrowserState,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;

  const anchor = resolveAnchor(action, state);
  if (!anchor) {
    return errorResult(action.id, startedAt, {
      code: "target-not-found",
      message: `Select target not found in the last snapshot`,
      retryable: false,
    });
  }

  if (action.values.length === 0) {
    return errorResult(action.id, startedAt, {
      code: "invalid-value",
      message: "Select requires at least one value",
      retryable: false,
    });
  }

  try {
    const role = anchor.role as Parameters<Page["getByRole"]>[0];
    const locator = anchor.name
      ? page.getByRole(role, { name: anchor.name, exact: true })
      : page.getByRole(role);
    const first = locator.first();

    const isNativeSelect = await first
      .evaluate((el) => (el as Element).tagName === "SELECT")
      .catch(() => false);

    if (isNativeSelect) {
      await first.selectOption(action.values, { timeout });
    } else {
      await selectViaAria(page, first, action.values, timeout);
    }

    const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
  }
}

function resolveAnchor(action: SelectAction, state: BrowserState): Node | null {
  const target = action.target;
  if (isWidgetRef(target)) {
    const widget = state.widgets.find((w) => w.id === target.widgetId);
    if (!widget) return null;
    if (widget.type !== "combobox" && widget.type !== "listbox") return null;
    const nodeId = widget.nodeIds[0];
    if (!nodeId) return null;
    return state.nodes.find((n) => n.id === nodeId) ?? null;
  }
  return state.nodes.find((n) => n.id === target.nodeId) ?? null;
}

async function selectViaAria(
  page: Page,
  anchor: PWLocator,
  values: string[],
  timeout: number,
): Promise<void> {
  const expanded = await anchor.getAttribute("aria-expanded").catch(() => null);
  if (expanded !== "true") {
    await anchor.click({ timeout });
  }

  for (const value of values) {
    const option = page.getByRole("option", { name: value, exact: true }).first();
    await option.waitFor({ state: "visible", timeout });
    await option.click({ timeout });
  }
}
