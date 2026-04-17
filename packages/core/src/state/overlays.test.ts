import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("BrowserState.overlays + dialog widget", () => {
  it("detects a modal dialog and emits a blocking overlay", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="dialog" aria-modal="true" aria-label="Confirm">
    <p>Are you sure?</p>
    <button>OK</button>
    <button>Cancel</button>
  </div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const dlg = state.widgets.find((w) => w.type === "dialog");
    expect(dlg, "dialog widget").toBeDefined();
    const ds = dlg!.state as { open: boolean; modal: boolean; title?: string };
    expect(ds.open).toBe(true);
    expect(ds.modal).toBe(true);
    expect(ds.title).toBe("Confirm");

    expect(state.overlays).toHaveLength(1);
    expect(state.overlays[0]!.type).toBe("modal");
    expect(state.overlays[0]!.blocking).toBe(true);
  });

  it("treats a role=alertdialog as blocking even without aria-modal", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="alertdialog" aria-label="Warning"><p>Watch out</p></div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    expect(state.overlays[0]?.blocking).toBe(true);
  });

  it("emits no overlays on a plain page", async () => {
    await session.goto("data:text/html,<title>plain</title><p>Hello</p>");
    const state = await session.snapshot();
    expect(state.overlays).toEqual([]);
  });
});
