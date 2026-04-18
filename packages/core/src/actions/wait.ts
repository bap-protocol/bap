import type {
  ActionResult,
  Locator as BAPLocator,
  WaitAction,
} from "@bap-protocol/spec";
import { classifyError, errorResult, successResult } from "./errors.js";
import type { DispatchContext } from "./cdp-helpers.js";

const DEFAULT_TIMEOUT = 30_000;
const POLL_INTERVAL = 100;

export async function dispatchWait(
  ctx: DispatchContext,
  action: WaitAction,
): Promise<ActionResult> {
  const startedAt = Date.now();
  const timeout = action.timeoutMs ?? DEFAULT_TIMEOUT;
  const c = action.condition;

  try {
    switch (c.kind) {
      case "duration":
        await sleep(c.ms);
        break;
      case "navigation":
        await waitForEvent(ctx, "Page.frameNavigated", timeout);
        break;
      case "network-idle":
        await waitForLifecycle(ctx, "networkIdle", timeout);
        break;
      case "node-appears":
        await pollVisibility(ctx, c.locator, true, timeout);
        break;
      case "node-disappears":
        await pollVisibility(ctx, c.locator, false, timeout);
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
    return successResult(action.id, startedAt);
  } catch (err) {
    return errorResult(action.id, startedAt, classifyError(err));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent(ctx: DispatchContext, name: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const off = ctx.client.on(name as "Page.loadEventFired", () => {
      off();
      resolve();
    });
    const handle = setTimeout(() => {
      off();
      reject(new Error(`Timed out waiting for ${name}`));
    }, timeout);
    handle.unref?.();
  });
}

function waitForLifecycle(ctx: DispatchContext, name: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const off = ctx.client.on("Page.lifecycleEvent", (payload) => {
      if ((payload as { name: string }).name !== name) return;
      off();
      resolve();
    });
    const handle = setTimeout(() => {
      off();
      reject(new Error(`Timed out waiting for lifecycle ${name}`));
    }, timeout);
    handle.unref?.();
  });
}

async function pollVisibility(
  ctx: DispatchContext,
  locator: BAPLocator,
  shouldBeVisible: boolean,
  timeout: number,
): Promise<void> {
  const selector = toCssSelector(locator);
  const expression = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return r.width > 0 && r.height > 0;
  })()`;

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const res = await ctx.client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    const visible = res.result.value === true;
    if (visible === shouldBeVisible) return;
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Timed out waiting for locator to ${shouldBeVisible ? "appear" : "disappear"}`);
}

function toCssSelector(loc: BAPLocator): string {
  switch (loc.strategy) {
    case "id":
      return `[id="${escapeAttr(loc.value)}"]`;
    case "testid":
      return `[data-testid="${escapeAttr(loc.value)}"]`;
    case "css":
      return loc.value;
    case "xpath":
      throw new Error("XPath locators are not supported by the CDP transport yet");
    case "role-name": {
      const [role = "", ...rest] = loc.value.split(":");
      const name = rest.join(":");
      return name
        ? `[role="${escapeAttr(role)}"][aria-label="${escapeAttr(name)}"]`
        : `[role="${escapeAttr(role)}"]`;
    }
  }
}

function escapeAttr(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
