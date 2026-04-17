import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

/**
 * Real-world probe: Airbnb homepage. Airbnb's search bar is the canonical
 * "combobox-heavy SPA" — location autocomplete, flexible-dates toggle,
 * guest count stepper. It also uses a custom calendar pattern identical
 * to Google Flights', so like Booking/Flights our v0.1 daterange-picker
 * detector does not fire here.
 *
 * Test is diagnostic: document what BAP sees, assert we extract a
 * non-trivial page without crashing.
 */

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Real-world: Airbnb homepage", () => {
  it("extracts the search UI and logs widget inventory", async () => {
    await session.goto("https://www.airbnb.com/", { waitUntil: "domcontentloaded" });
    const state = await session.snapshot();

    console.log("[airbnb] title:", JSON.stringify(state.title));
    console.log("[airbnb] url:", state.url);
    console.log("[airbnb] nodes:", state.nodes.length);
    console.log("[airbnb] widgets:", summarize(state.widgets));
    console.log("[airbnb] overlays:", state.overlays.length);

    expect(state.version).toBe("0.1");
    expect(state.url).toMatch(/airbnb\.com/);
    expect(state.nodes.length).toBeGreaterThan(30);

    // At least the search button should be reachable — it anchors the
    // entire flow on the page.
    const searchButton = state.nodes.find(
      (n) => n.role === "button" && /search/i.test(n.name ?? ""),
    );
    if (searchButton) {
      console.log(`[airbnb] search button: ${JSON.stringify(searchButton.name)}`);
    } else {
      console.warn("[airbnb] WARN: no search button detected — UI may have changed");
    }

    // Custom stepper (guest count) is one of the v0.1 widget gaps —
    // BAP has no `stepper` type, so guest-count controls appear as
    // two unrelated buttons. Document the gap.
    const stepperLikeButtons = state.nodes.filter(
      (n) => n.role === "button" && /^[+\-−]$|add|remove|increase|decrease/i.test(n.name ?? ""),
    );
    console.log(`[airbnb] stepper-like buttons (no widget yet): ${stepperLikeButtons.length}`);
  }, 60_000);
});

function summarize(widgets: { type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of widgets) out[w.type] = (out[w.type] ?? 0) + 1;
  return out;
}
