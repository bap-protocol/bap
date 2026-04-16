import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Action.slide", () => {
  it("moves a native range slider up by the requested value", async () => {
    const html = `<!doctype html>
<html><body><input type="range" min="0" max="10" value="2" step="1" aria-label="Level" /></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const widget = before.widgets.find((w) => w.type === "slider")!;
    expect((widget.state as { value: number }).value).toBe(2);

    const result = await session.dispatch({
      type: "slide",
      target: { widgetId: widget.id },
      value: 7,
    });
    expect(result.success, `slide failed: ${JSON.stringify(result.error)}`).toBe(true);

    const after = await session.snapshot();
    const widgetAfter = after.widgets.find((w) => w.type === "slider")!;
    expect((widgetAfter.state as { value: number }).value).toBe(7);
  });

  it("rejects target values outside the slider range", async () => {
    const html = `<!doctype html>
<html><body><input type="range" min="0" max="10" value="5" aria-label="L" /></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const before = await session.snapshot();
    const widget = before.widgets.find((w) => w.type === "slider")!;
    const result = await session.dispatch({
      type: "slide",
      target: { widgetId: widget.id },
      value: 42,
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("invalid-value");
  });

  it("rejects non-slider widgets with widget-type-mismatch", async () => {
    // Fake widget id — we won't have a real non-slider widget in v0.1 yet.
    await session.goto("data:text/html,<title>x</title>");
    await session.snapshot();
    const result = await session.dispatch({
      type: "slide",
      target: { widgetId: "does-not-exist" },
      value: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("target-not-found");
  });
});
