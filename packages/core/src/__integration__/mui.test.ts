import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

/**
 * Real-world integration tests. These hit live external sites and are
 * excluded from the default `test` run — invoke via `pnpm test:integration`.
 *
 * Purpose: verify BAP produces meaningful output against production UI
 * libraries (MUI, Ant Design, etc.), not just synthetic HTML fixtures.
 */

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Real-world: MUI Slider docs", () => {
  it("detects Material UI sliders as BAP slider widgets", async () => {
    await session.goto("https://mui.com/material-ui/react-slider/", {
      waitUntil: "domcontentloaded",
    });
    const state = await session.snapshot();

    const sliders = state.widgets.filter((w) => w.type === "slider");
    console.log(`MUI page — nodes: ${state.nodes.length}, widgets: ${state.widgets.length}, sliders: ${sliders.length}`);

    expect(sliders.length, "MUI docs should expose sliders").toBeGreaterThan(0);

    const first = sliders[0]!;
    const s = first.state as { min: number; max: number; value: number };
    console.log(`First slider: min=${s.min} max=${s.max} value=${s.value}`);
    expect(typeof s.min).toBe("number");
    expect(typeof s.max).toBe("number");
    expect(typeof s.value).toBe("number");
    expect(s.min).toBeLessThan(s.max);

    const anchorNode = state.nodes.find((n) => n.id === first.nodeIds[0]);
    expect(anchorNode?.role).toBe("slider");
    expect(anchorNode?.rect, "slider anchor has a rect").toBeDefined();
  }, 60_000);
});
