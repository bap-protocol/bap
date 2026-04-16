import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Widget detection", () => {
  it("detects a native range input as a slider widget with min/max/value", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Slider</title></head>
  <body>
    <input type="range" min="0" max="100" value="42" aria-label="Volume" />
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    expect(state.widgets, "widgets present").toHaveLength(1);
    const w = state.widgets[0]!;
    expect(w.type).toBe("slider");
    expect(w.state).toMatchObject({ min: 0, max: 100, value: 42 });
    expect(w.hints).toMatchObject({
      fillStrategies: ["aria-valuenow", "keyboard", "drag"],
    });

    const sliderNode = state.nodes.find((n) => n.id === w.nodeIds[0]);
    expect(sliderNode?.role).toBe("slider");
    expect(sliderNode?.name).toBe("Volume");
  });

  it("detects a custom ARIA slider", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Custom Slider</title></head>
  <body>
    <div role="slider"
         aria-valuemin="10"
         aria-valuemax="20"
         aria-valuenow="15"
         aria-label="Rating"
         tabindex="0"
         style="width:200px;height:24px;background:#ccc">
    </div>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    expect(state.widgets).toHaveLength(1);
    expect(state.widgets[0]!.state).toMatchObject({ min: 10, max: 20, value: 15 });
  });

  it("does not produce widgets for pages without any", async () => {
    const html = `<!doctype html><html><head><title>Plain</title></head><body><button>Go</button></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    expect(state.widgets).toEqual([]);
  });
});
