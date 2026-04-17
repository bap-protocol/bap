import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDefaultAdapter, loadBundledSpecs, runCompliance } from "./index.js";
import type { ComplianceAdapter } from "./types.js";

let adapter: ComplianceAdapter;

beforeAll(async () => {
  adapter = await createDefaultAdapter();
}, 60_000);

afterAll(async () => {
  await adapter?.close?.();
});

describe("Compliance runner", () => {
  it("runs bundled specs against @bap-protocol/core and all pass", async () => {
    const specs = loadBundledSpecs();
    expect(specs.length, "at least one bundled spec").toBeGreaterThan(0);

    const report = await runCompliance(adapter, specs);

    for (const r of report.results) {
      if (!r.pass) console.error(`[${r.name}] FAILURES:`, r.failures);
    }

    expect(report.summary.failed, "no failures").toBe(0);
    expect(report.summary.passed).toBe(report.summary.total);
  }, 60_000);

  it("fails clearly when an expectation does not match", async () => {
    const report = await runCompliance(adapter, [
      {
        name: "deliberately-wrong: expects a datepicker widget",
        fixture: { kind: "inline", html: `<!doctype html><html><body><input type="range" aria-label="V" min="0" max="10"/></body></html>` },
        expectations: {
          widgets: [{ type: "datepicker" }],
        },
      },
    ]);

    expect(report.summary.failed).toBe(1);
    expect(report.results[0]!.failures[0]).toMatch(/no widget matches/);
  }, 60_000);
});
