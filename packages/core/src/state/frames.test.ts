import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Cross-frame extraction", () => {
  it("captures nodes from same-origin iframes and links them to the right frame", async () => {
    const inner = `<!doctype html><html><body><button>Inner</button></body></html>`;
    const outer = `<!doctype html>
<html>
  <head><title>Parent</title></head>
  <body>
    <button>Outer</button>
    <iframe srcdoc='${inner.replace(/'/g, "&#39;")}'></iframe>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(outer)}`);
    const state = await session.snapshot();

    expect(state.frames.length).toBeGreaterThanOrEqual(2);
    const child = state.frames.find((f) => f.parentFrameId !== undefined);
    expect(child, "child frame present").toBeDefined();

    const outerBtn = state.nodes.find((n) => n.role === "button" && n.name === "Outer");
    const innerBtn = state.nodes.find((n) => n.role === "button" && n.name === "Inner");
    expect(outerBtn, "outer button present").toBeDefined();
    expect(innerBtn, "inner button present").toBeDefined();
    expect(outerBtn!.frameId).not.toBe(innerBtn!.frameId);
    expect(innerBtn!.frameId).toBe(child!.id);
  });
});
