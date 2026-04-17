import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

/**
 * Real-world probe: Google Flights. This page is the densest
 * airport-autocomplete + daterange-picker combination in common use.
 * Both patterns are custom ARIA (not native <select>, not native
 * <input type="date">), so this test exposes the v0.1 detector gap:
 * we correctly see the underlying ARIA comboboxes, but our
 * daterange-picker detector does not fire on Google's two-combobox
 * date-range pattern.
 *
 * Purpose of the test is diagnostic — document what BAP sees on a
 * heavy custom-widget SPA, not to hit pass/fail on specific counts
 * that would be brittle against Google's A/B experiments.
 */

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Real-world: Google Flights", () => {
  it("extracts the flight search UI and surfaces custom-widget gaps", async () => {
    await session.goto("https://www.google.com/travel/flights", {
      waitUntil: "networkidle",
    });
    const state = await session.snapshot();

    console.log("[flights] title:", JSON.stringify(state.title));
    console.log("[flights] url:", state.url);
    console.log("[flights] nodes:", state.nodes.length);
    console.log("[flights] widgets:", summarize(state.widgets));
    console.log("[flights] overlays:", state.overlays.length);

    // Google may serve consent redirect on first visit from some regions.
    const isConsent = /consent|before you continue/i.test(state.title);
    if (isConsent) {
      console.warn("[flights] WARN: consent interstitial — widget detection will be partial");
    }

    // --- Hard assertions ---
    expect(state.version).toBe("0.1");
    expect(state.nodes.length).toBeGreaterThan(isConsent ? 5 : 50);

    if (!isConsent) {
      const comboboxes = state.widgets.filter((w) => w.type === "combobox");
      console.log(`[flights] comboboxes detected: ${comboboxes.length}`);
      expect(comboboxes.length, "at least one combobox (airport or trip-type)").toBeGreaterThan(0);

      // Google's airport inputs are role=combobox with aria-autocomplete.
      // Log the accessible names we find — helps us see which inputs
      // exist and whether accessible-name extraction holds up.
      const comboNames = comboboxes
        .map((w) => {
          const node = state.nodes.find((n) => n.id === w.nodeIds[0]);
          return node?.name;
        })
        .filter((n): n is string => !!n);
      console.log("[flights] combobox names:", comboNames);

      // Documented gap: custom daterange pattern. v0.1 detector won't fire.
      const dateranges = state.widgets.filter((w) => w.type === "daterange-picker");
      console.log(`[flights] daterange-pickers detected: ${dateranges.length} (expected: 0 with v0.1)`);
    }
  }, 60_000);
});

function summarize(widgets: { type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of widgets) out[w.type] = (out[w.type] ?? 0) + 1;
  return out;
}
