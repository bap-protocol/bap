import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("BrowserState.focus", () => {
  it("sets focus to the focused input after interaction", async () => {
    const html = `<!doctype html>
<html><body>
  <input type="text" aria-label="First" />
  <input type="text" aria-label="Second" />
  <script>
    document.querySelector('input[aria-label="Second"]').focus();
  </script>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    expect(state.focus, "focus is set").toBeDefined();
    const focusedNode = state.nodes.find((n) => n.id === state.focus!.nodeId);
    expect(focusedNode?.name).toBe("Second");
    expect(focusedNode?.state.focused).toBe(true);
  });

  it("leaves focus undefined when no element is focused", async () => {
    const html = `<!doctype html>
<html><body><p>Plain</p></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    // Either focus is undefined, or it resolves to body/document root — which
    // has no interactable role.
    if (state.focus) {
      const node = state.nodes.find((n) => n.id === state.focus!.nodeId);
      expect(node?.interactable).not.toBe(true);
    }
  });
});
