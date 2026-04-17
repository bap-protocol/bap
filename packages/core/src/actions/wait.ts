import type { Locator as PWLocator, Page } from "playwright";
import type {
  ActionResult,
  Locator as BAPLocator,
  WaitAction,
} from "@bap-protocol/spec";
import { classifyPlaywrightError, errorResult } from "./errors.js";

const DEFAULT_TIMEOUT = 30_000;

export async function dispatchWait(page: Page, action: WaitAction): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;
  const c = action.condition;

  try {
    switch (c.kind) {
      case "duration":
        await page.waitForTimeout(c.ms);
        break;
      case "navigation":
        await page.waitForNavigation({ timeout });
        break;
      case "network-idle":
        await page.waitForLoadState("networkidle", { timeout });
        break;
      case "node-appears":
        await resolveLocator(page, c.locator).first().waitFor({ state: "visible", timeout });
        break;
      case "node-disappears":
        await resolveLocator(page, c.locator).first().waitFor({ state: "hidden", timeout });
        break;
      default: {
        const never: never = c;
        void never;
        return errorResult(action.id, startedAt, {
          code: "invalid-value",
          message: `Unknown wait condition`,
          retryable: false,
        });
      }
    }
    const result: ActionResult = { success: true, durationMs: Date.now() - startedAt };
    if (action.id !== undefined) result.id = action.id;
    return result;
  } catch (err) {
    return errorResult(action.id, startedAt, classifyPlaywrightError(err));
  }
}

function resolveLocator(page: Page, loc: BAPLocator): PWLocator {
  switch (loc.strategy) {
    case "id":
      return page.locator(`[id="${loc.value.replace(/"/g, '\\"')}"]`);
    case "testid":
      return page.getByTestId(loc.value);
    case "xpath":
      return page.locator(`xpath=${loc.value}`);
    case "css":
      return page.locator(loc.value);
    case "role-name": {
      const [role, ...rest] = loc.value.split(":");
      const name = rest.join(":");
      const r = role as Parameters<Page["getByRole"]>[0];
      return name
        ? page.getByRole(r, { name, exact: true })
        : page.getByRole(r);
    }
  }
}
