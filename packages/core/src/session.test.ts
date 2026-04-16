import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "./session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Session", () => {
  it("snapshots a minimal page", async () => {
    const html = `<!doctype html>
<html lang="en">
  <head><title>Smoke</title></head>
  <body>
    <h1>Hello</h1>
    <button>Click me</button>
    <input type="text" aria-label="Type here" required />
    <a href="/next">Next page</a>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    expect(state.version).toBe("0.1");
    expect(state.title).toBe("Smoke");
    expect(state.frames).toEqual([expect.objectContaining({ id: "main" })]);
    expect(state.nodes.length).toBeGreaterThan(0);

    const button = state.nodes.find((n) => n.role === "button");
    expect(button, "button node present").toBeDefined();
    expect(button?.name).toBe("Click me");
    expect(button?.interactable).toBe(true);
    expect(button?.editable).toBe(false);

    const textbox = state.nodes.find((n) => n.role === "textbox");
    expect(textbox, "textbox node present").toBeDefined();
    expect(textbox?.name).toBe("Type here");
    expect(textbox?.interactable).toBe(true);
    expect(textbox?.editable).toBe(true);
    expect(textbox?.state.required).toBe(true);

    const link = state.nodes.find((n) => n.role === "link");
    expect(link, "link node present").toBeDefined();
    expect(link?.name).toBe("Next page");
    expect(link?.interactable).toBe(true);
  });

  it("returns a valid viewport and metadata", async () => {
    await session.goto("data:text/html,<title>x</title>");
    const state = await session.snapshot();
    expect(state.viewport.width).toBeGreaterThan(0);
    expect(state.viewport.height).toBeGreaterThan(0);
    expect(state.metadata.userAgent).toContain("Chrome");
    expect(state.metadata.timezone).toBeTruthy();
    expect(state.metadata.language).toBeTruthy();
  });
});
