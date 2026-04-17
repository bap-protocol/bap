import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

});

describe("Action.scroll", () => {
  it("scrolls the window to an absolute position", async () => {
    const html = `<!doctype html>
<html><body style="height:4000px"><p>top</p></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await session.snapshot();

    const result = await session.dispatch({ type: "scroll", to: { x: 0, y: 1500 } });
    expect(result.success, `scroll failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    expect(after.viewport.scrollY).toBeGreaterThanOrEqual(1400);
  });

  it("scrolls to bottom", async () => {
    const html = `<!doctype html>
<html><body style="height:4000px"></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await session.snapshot();

    const result = await session.dispatch({ type: "scroll", to: "bottom" });
    expect(result.success).toBe(true);
    const after = await session.snapshot();
    expect(after.viewport.scrollY).toBeGreaterThan(1000);
  });

  it("scrolls by a relative delta", async () => {
    const html = `<!doctype html>
<html><body style="height:4000px"></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await session.snapshot();
    await session.dispatch({ type: "scroll", to: { x: 0, y: 200 } });
    await session.snapshot();
    const result = await session.dispatch({ type: "scroll", to: { delta: { x: 0, y: 300 } } });
    expect(result.success).toBe(true);
    const after = await session.snapshot();
    expect(after.viewport.scrollY).toBeGreaterThanOrEqual(500);
  });
});

describe("Action.wait", () => {
  it("resolves after a duration", async () => {
    await session.goto("data:text/html,<title>x</title>");
    await session.snapshot();
    const result = await session.dispatch({
      type: "wait",
      condition: { kind: "duration", ms: 120 },
    });
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(100);
  });

  it("resolves when a node appears", async () => {
    const html = `<!doctype html>
<html><body>
  <script>setTimeout(function(){
    var d = document.createElement('div');
    d.id = 'ready';
    d.textContent = 'Ready';
    document.body.appendChild(d);
  }, 150);</script>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await session.snapshot();
    const result = await session.dispatch({
      type: "wait",
      condition: { kind: "node-appears", locator: { strategy: "id", value: "ready" } },
      timeoutMs: 3_000,
    });
    expect(result.success, `wait failed: ${JSON.stringify(result.error)}`).toBe(true);
  });

  it("times out when a node never appears", async () => {
    await session.goto("data:text/html,<title>x</title>");
    await session.snapshot();
    const result = await session.dispatch({
      type: "wait",
      condition: { kind: "node-appears", locator: { strategy: "css", value: "#nope" } },
      timeoutMs: 200,
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("timeout");
    expect(result.error?.retryable).toBe(true);
  });
});

describe("Action.upload", () => {
  it("uploads a file to an input[type=file] via widget target", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bap-upload-"));
    const filePath = join(dir, "hello.txt");
    writeFileSync(filePath, "hi");

    try {
      const html = `<!doctype html>
<html><body>
  <input type="file" aria-label="Attachment" id="fi" />
  <script>
    document.getElementById('fi').addEventListener('change', (e) => {
      document.title = 'files:' + Array.from(e.target.files).map(f => f.name).join(',');
    });
  </script>
</body></html>`;
      await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const before = await session.snapshot();
      const widget = before.widgets.find((w) => w.type === "fileupload");
      expect(widget, "fileupload widget present").toBeDefined();

      const result = await session.dispatch({
        type: "upload",
        target: { widgetId: widget!.id },
        files: [filePath],
      });
      expect(result.success, `upload failed: ${JSON.stringify(result.error)}`).toBe(true);

      const after = await session.snapshot();
      expect(after.title).toBe("files:hello.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails on empty files array", async () => {
    const html = `<!doctype html>
<html><body><input type="file" aria-label="File" /></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    const widget = state.widgets.find((w) => w.type === "fileupload")!;

    const result = await session.dispatch({
      type: "upload",
      target: { widgetId: widget.id },
      files: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("invalid-value");
  });
});

describe("Action.select", () => {
  it("selects a value on a native <select>", async () => {
    const html = `<!doctype html>
<html><body>
  <select aria-label="Country" id="s">
    <option value="us">USA</option>
    <option value="ca">Canada</option>
    <option value="mx">Mexico</option>
  </select>
  <script>
    document.getElementById('s').addEventListener('change', (e) => {
      document.title = 'sel:' + e.target.value;
    });
  </script>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const combo = before.widgets.find((w) => w.type === "combobox")!;

    const result = await session.dispatch({
      type: "select",
      target: { widgetId: combo.id },
      values: ["ca"],
    });
    expect(result.success, `select failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    expect(after.title).toBe("sel:ca");
  });

  it("selects an option in an ARIA listbox by name", async () => {
    const html = `<!doctype html>
<html><body>
  <ul role="listbox" aria-label="Colors" tabindex="0" id="lb">
    <li role="option" tabindex="-1">Red</li>
    <li role="option" tabindex="-1">Green</li>
    <li role="option" tabindex="-1">Blue</li>
  </ul>
  <script>
    document.getElementById('lb').addEventListener('click', (e) => {
      if (e.target.getAttribute('role') === 'option') {
        document.title = 'opt:' + e.target.textContent;
      }
    });
  </script>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const lb = before.widgets.find((w) => w.type === "listbox")!;

    const result = await session.dispatch({
      type: "select",
      target: { widgetId: lb.id },
      values: ["Green"],
    });
    expect(result.success, `select failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    expect(after.title).toBe("opt:Green");
  });
});

describe("Action.pick-date", () => {
  it("picks a date on a native datepicker widget", async () => {
    const html = `<!doctype html>
<html><body>
  <input type="date" aria-label="When" id="d" />
  <script>
    document.getElementById('d').addEventListener('change', (e) => {
      document.title = 'd:' + e.target.value;
    });
  </script>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const widget = before.widgets.find((w) => w.type === "datepicker")!;

    const result = await session.dispatch({
      type: "pick-date",
      target: { widgetId: widget.id },
      date: "2026-06-15",
    });
    expect(result.success, `pick-date failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    expect(after.title).toBe("d:2026-06-15");
  });

  it("picks a range on a daterange-picker widget", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="group" aria-label="Range">
    <input type="date" aria-label="From" id="a" />
    <input type="date" aria-label="To" id="b" />
  </div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const widget = before.widgets.find((w) => w.type === "daterange-picker")!;

    const result = await session.dispatch({
      type: "pick-date",
      target: { widgetId: widget.id },
      date: { start: "2026-07-01", end: "2026-07-10" },
    });
    expect(result.success, `pick-date failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    const from = after.nodes.find((n) => n.name === "From");
    const to = after.nodes.find((n) => n.name === "To");
    expect(from?.value).toBe("2026-07-01");
    expect(to?.value).toBe("2026-07-10");
  });

  it("rejects a non-date widget", async () => {
    const html = `<!doctype html>
<html><body><input type="range" aria-label="V" min="0" max="10" /></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    const slider = state.widgets.find((w) => w.type === "slider")!;

    const result = await session.dispatch({
      type: "pick-date",
      target: { widgetId: slider.id },
      date: "2026-01-01",
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("widget-type-mismatch");
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
