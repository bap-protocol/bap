import type { BrowserState, Node, Rect, Viewport } from "@bap-protocol/spec";
import type { CDPSession } from "../transport/cdp-client.js";

export interface DispatchContext {
  client: CDPSession;
  backendIdByNodeId: Map<string, number>;
}

export interface Point {
  x: number;
  y: number;
}

export function rectCenter(rect: Rect, viewport: Viewport): Point {
  // DOMSnapshot emits document-space coordinates. Input.dispatchMouseEvent
  // expects viewport-space, so subtract the scroll offset.
  return {
    x: rect.x + rect.width / 2 - viewport.scrollX,
    y: rect.y + rect.height / 2 - viewport.scrollY,
  };
}

export function resolveNode(state: BrowserState, nodeId: string): Node | undefined {
  return state.nodes.find((n) => n.id === nodeId);
}

export async function scrollIntoView(
  ctx: DispatchContext,
  nodeId: string,
): Promise<void> {
  const backendNodeId = ctx.backendIdByNodeId.get(nodeId);
  if (backendNodeId === undefined) return;
  try {
    await ctx.client.send("DOM.scrollIntoViewIfNeeded", { backendNodeId });
  } catch {
    // Non-fatal: element might not support it; clicks can still land via coords.
  }
}

export async function mouseClick(
  client: CDPSession,
  point: Point,
  opts: { button?: "left" | "middle" | "right"; clickCount?: number } = {},
): Promise<void> {
  const button = opts.button ?? "left";
  const clickCount = opts.clickCount ?? 1;
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
    buttons: 0,
  });
  for (let i = 1; i <= clickCount; i++) {
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button,
      buttons: buttonMask(button),
      clickCount: i,
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point.x,
      y: point.y,
      button,
      buttons: 0,
      clickCount: i,
    });
  }
}

function buttonMask(button: "left" | "middle" | "right"): number {
  return button === "left" ? 1 : button === "right" ? 2 : 4;
}

/** Returns true if DOM.focus succeeded; caller can fall back to a click. */
export async function focusElement(ctx: DispatchContext, nodeId: string): Promise<boolean> {
  const backendNodeId = ctx.backendIdByNodeId.get(nodeId);
  if (backendNodeId === undefined) return false;
  try {
    await ctx.client.send("DOM.focus", { backendNodeId });
    return true;
  } catch {
    return false;
  }
}

// Minimal US-keyboard map — enough for control keys and ASCII. Anything not
// mapped falls back to using only `key` + `text`, which works for text input.
// `text` is what Chromium inserts on keyDown; for named keys like Enter it's
// the carriage return (triggers implicit form submit), for ASCII it's the char.
const KEY_CODES: Record<string, { keyCode: number; code: string; text?: string }> = {
  Enter: { keyCode: 13, code: "Enter", text: "\r" },
  Tab: { keyCode: 9, code: "Tab" },
  Backspace: { keyCode: 8, code: "Backspace" },
  Delete: { keyCode: 46, code: "Delete" },
  ArrowLeft: { keyCode: 37, code: "ArrowLeft" },
  ArrowUp: { keyCode: 38, code: "ArrowUp" },
  ArrowRight: { keyCode: 39, code: "ArrowRight" },
  ArrowDown: { keyCode: 40, code: "ArrowDown" },
  Escape: { keyCode: 27, code: "Escape" },
  Home: { keyCode: 36, code: "Home" },
  End: { keyCode: 35, code: "End" },
  PageUp: { keyCode: 33, code: "PageUp" },
  PageDown: { keyCode: 34, code: "PageDown" },
  Space: { keyCode: 32, code: "Space", text: " " },
};

export async function pressKey(
  client: CDPSession,
  key: string,
  opts: { modifiers?: number } = {},
): Promise<void> {
  const info = KEY_CODES[key];
  const modifiers = opts.modifiers ?? 0;
  const keyDown: Record<string, unknown> = info
    ? { key, code: info.code, windowsVirtualKeyCode: info.keyCode, modifiers }
    : { key, modifiers };
  if (info?.text !== undefined) keyDown.text = info.text;
  const keyUp: Record<string, unknown> = info
    ? { key, code: info.code, windowsVirtualKeyCode: info.keyCode, modifiers }
    : { key, modifiers };
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", ...keyDown });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", ...keyUp });
}

export async function typeText(client: CDPSession, text: string): Promise<void> {
  // insertText skips key-down/up events but fires an `input` event, which is
  // what forms actually observe. Sufficient for <input>/<textarea>/contentEditable.
  await client.send("Input.insertText", { text });
}

export async function clearInput(ctx: DispatchContext): Promise<void> {
  // Select all + delete. Ctrl on Windows/Linux, Meta on macOS — dispatching
  // both is safe because only the matching modifier gets honored.
  await pressKey(ctx.client, "a", { modifiers: 2 }); // ctrl
  await pressKey(ctx.client, "Delete");
}
