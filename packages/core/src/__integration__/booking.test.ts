import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

/**
 * Real-world probe: Booking.com homepage. This exercises the heaviest
 * daterange-picker pattern on the open web — a custom ARIA combobox
 * with a portalled dialog calendar, NOT native <input type="date">.
 *
 * Our v0.1 daterange-picker detector is intentionally narrow (native
 * inputs only). This test therefore documents what BAP sees today on a
 * real site: what widgets fire, which custom patterns are invisible,
 * and where the v0.2 widget catalog needs to grow.
 *
 * Assertions are deliberately loose — remote sites change. We fail only
 * on total extraction breakage; everything else is logged as signal.
 */

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Real-world: Booking.com homepage", () => {
  it("extracts a coherent BrowserState and surfaces detector gaps", async () => {
    await session.goto("https://www.booking.com/", { waitUntil: "networkidle" });
    const state = await session.snapshot();

    console.log("[booking] title:", JSON.stringify(state.title));
    console.log("[booking] url after goto:", state.url);
    console.log("[booking] nodes length:", state.nodes.length);
    if (state.nodes.length < 10) {
      console.log("[booking] full snapshot (bot-wall suspected):", JSON.stringify(state.nodes, null, 2));
    }

    // --- Hard assertions: BAP must produce something sensible ---
    // Node count varies wildly on Booking: cookie-wall mode shows ~30
    // nodes, post-consent ~500+, bot-check stub ~2. The point of this
    // test is to verify BAP doesn't crash or produce a zero state on a
    // heavy real-world SPA, not to fingerprint a specific DOM layout.
    expect(state.version).toBe("0.1");
    expect(state.url).toMatch(/booking\.com/);
    expect(state.nodes.length, "nodes extracted").toBeGreaterThan(10);
    expect(state.frames.length, "at least one frame").toBeGreaterThanOrEqual(1);
    expect(state.metadata.userAgent).toContain("Chrome");

    // --- Soft observations: logged for diagnostic value ---
    const widgetInventory = summarizeWidgets(state.widgets);
    console.log("[booking] widget inventory:", widgetInventory);
    console.log("[booking] total nodes:", state.nodes.length);
    console.log("[booking] frames:", state.frames.length);
    console.log("[booking] overlays:", state.overlays.length);

    const comboboxes = state.widgets.filter((w) => w.type === "combobox");
    console.log(`[booking] comboboxes detected: ${comboboxes.length}`);

    const interactables = state.nodes.filter((n) => n.interactable).length;
    console.log(`[booking] interactable nodes: ${interactables}`);

    // --- Detector gap observations (expected misses) ---
    // Booking.com's date picker is a custom ARIA combobox + portalled
    // dialog calendar, not a native <input type="date">. Our v0.1
    // daterange-picker detector only fires on native inputs, so we
    // expect zero daterange-picker widgets here. If that ever changes
    // (because Booking adds native inputs, or we relax the detector),
    // this log will tell us.
    const dateranges = state.widgets.filter((w) => w.type === "daterange-picker");
    console.log(`[booking] daterange-pickers detected: ${dateranges.length} (expected: 0 with v0.1 detector)`);
  }, 60_000);
});

function summarizeWidgets(widgets: { type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of widgets) out[w.type] = (out[w.type] ?? 0) + 1;
  return out;
}
