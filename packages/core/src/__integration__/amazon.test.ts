import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

/**
 * Real-world probe: Amazon search results page. Amazon is the benchmark
 * site for BAP because (a) it's where Sentinel's competitive advantage
 * shows up, (b) the page is dense with comboboxes (sort, category) and
 * radiogroups (product variants on PDPs), (c) overlays are minimal —
 * a clean stress test for detector breadth.
 *
 * Uses a search URL rather than the homepage so we hit a listing page
 * regardless of GeoIP / personalization.
 */

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Real-world: Amazon search", () => {
  it("extracts a dense listing page and detects navigation widgets", async () => {
    // Deterministic search URL avoids homepage personalization.
    await session.goto("https://www.amazon.com/s?k=headphones", {
      waitUntil: "domcontentloaded",
    });
    const state = await session.snapshot();

    console.log("[amazon] title:", JSON.stringify(state.title));
    console.log("[amazon] url:", state.url);
    console.log("[amazon] nodes:", state.nodes.length);
    console.log("[amazon] widgets:", summarize(state.widgets));
    console.log("[amazon] overlays:", state.overlays.length);

    // If Amazon served us a CAPTCHA or bot-check wall, the title tells us.
    const isBotWall = /robot|captcha|sorry/i.test(state.title);
    if (isBotWall) {
      console.warn("[amazon] WARN: served a bot-check page, test will be partial");
    }

    // --- Hard assertions ---
    expect(state.version).toBe("0.1");
    expect(state.url).toMatch(/amazon\.com/);
    expect(state.nodes.length, "substantial DOM extracted").toBeGreaterThan(
      isBotWall ? 5 : 100,
    );

    if (!isBotWall) {
      // Amazon search has at least one combobox (sort order: Featured, Price,
      // Avg. Customer Review). This anchors combobox detection against a
      // native <select> in production traffic.
      const comboboxes = state.widgets.filter((w) => w.type === "combobox");
      console.log(`[amazon] comboboxes detected: ${comboboxes.length}`);
      expect(comboboxes.length, "sort/filter combobox detected").toBeGreaterThan(0);

      // Interactable nodes — search box, pagination, filter links.
      const interactables = state.nodes.filter((n) => n.interactable);
      console.log(`[amazon] interactable nodes: ${interactables.length}`);
      expect(interactables.length).toBeGreaterThan(20);

      // Widget: search textbox reachable by its accessible name.
      const searchBox = state.nodes.find(
        (n) => n.role === "searchbox" || (n.role === "textbox" && /search/i.test(n.name ?? "")),
      );
      if (searchBox) {
        console.log(`[amazon] search box found: role=${searchBox.role} name=${JSON.stringify(searchBox.name)}`);
      } else {
        console.warn("[amazon] WARN: no searchbox/search-textbox detected");
      }
    }
  }, 60_000);
});

function summarize(widgets: { type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of widgets) out[w.type] = (out[w.type] ?? 0) + 1;
  return out;
}
