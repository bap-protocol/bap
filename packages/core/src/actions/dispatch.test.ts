import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Action.click", () => {
  it("clicks a button and mutates the page state", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Click</title></head>
  <body>
    <button id="b" onclick="this.textContent='Clicked'">Press me</button>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const button = before.nodes.find((n) => n.role === "button");
    expect(button?.name).toBe("Press me");

    const result = await session.dispatch({
      type: "click",
      target: { nodeId: button!.id, frameId: button!.frameId },
    });
    expect(result.success, `click failed: ${JSON.stringify(result.error)}`).toBe(true);
    expect(result.durationMs).toBeGreaterThan(0);

    const after = await session.snapshot();
    const buttonAfter = after.nodes.find((n) => n.role === "button");
    expect(buttonAfter?.name).toBe("Clicked");
  });

  it("returns target-not-found for a stale node id", async () => {
    await session.goto("data:text/html,<title>empty</title>");
    await session.snapshot();
    const result = await session.dispatch({
      type: "click",
      target: { nodeId: "nonexistent-id", frameId: "main" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("target-not-found");
    expect(result.error?.retryable).toBe(false);
  });

  it("returns 'unknown' action error for unimplemented types", async () => {
    await session.goto("data:text/html,<title>x</title>");
    await session.snapshot();
    // `scroll` is in the v0.1 spec but not yet implemented in core.
    const result = await session.dispatch({
      type: "scroll",
      to: "bottom",
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("unknown");
  });
});

describe("Action.fill", () => {
  it("fills a textbox and mutates its value", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Fill</title></head>
  <body>
    <input type="text" aria-label="Email" />
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const input = before.nodes.find((n) => n.role === "textbox");
    expect(input?.name).toBe("Email");

    const result = await session.dispatch({
      type: "fill",
      target: { nodeId: input!.id, frameId: input!.frameId },
      value: "alice@example.com",
    });
    expect(result.success, `fill failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    const inputAfter = after.nodes.find((n) => n.role === "textbox");
    expect(inputAfter?.value).toBe("alice@example.com");
  });

  it("submits a form when submit: true", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Form</title></head>
  <body>
    <form onsubmit="document.title='submitted'; return false">
      <input type="text" aria-label="Query" />
    </form>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const input = before.nodes.find((n) => n.role === "textbox");

    const result = await session.dispatch({
      type: "fill",
      target: { nodeId: input!.id, frameId: input!.frameId },
      value: "bap",
      submit: true,
    });
    expect(result.success).toBe(true);

    const after = await session.snapshot();
    expect(after.title).toBe("submitted");
  });

  it("rejects non-editable targets", async () => {
    const html = `<!doctype html>
<html><body><button>Go</button></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const button = before.nodes.find((n) => n.role === "button");

    const result = await session.dispatch({
      type: "fill",
      target: { nodeId: button!.id, frameId: button!.frameId },
      value: "nope",
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("target-not-interactable");
    expect(result.error?.retryable).toBe(false);
  });

  it("produces a meaningful diff between snapshots around a fill", async () => {
    const html = `<!doctype html>
<html><body><input type="text" aria-label="Name" /></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const input = before.nodes.find((n) => n.role === "textbox")!;

    await session.dispatch({
      type: "fill",
      target: { nodeId: input.id, frameId: input.frameId },
      value: "Alice",
    });
    const after = await session.snapshot();

    const diff = session.diff(before, after);
    const mods = diff.changes.filter((c) => c.kind === "node-modified");
    // The only semantic change we care about is the textbox value.
    const textboxChange = mods.find(
      (c) => c.kind === "node-modified" && (c.fields as Record<string, unknown>).value === "Alice",
    );
    expect(textboxChange, `expected a textbox value change, got: ${JSON.stringify(mods, null, 2)}`).toBeDefined();
    // And the diff should be much smaller than the full snapshot.
    const diffSize = JSON.stringify(diff).length;
    const snapshotSize = JSON.stringify(after).length;
    expect(diffSize).toBeLessThan(snapshotSize);
  });
});
