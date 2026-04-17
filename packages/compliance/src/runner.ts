import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "./matcher.js";
import type {
  ComplianceAdapter,
  ComplianceReport,
  ComplianceResult,
  ComplianceSpec,
} from "./types.js";

/**
 * Run a set of compliance specs against an adapter. The adapter exposes
 * the single `snapshot(url)` entry point; the runner is transport- and
 * language-agnostic (calls into the adapter; does not care how the state
 * was captured).
 *
 * Fixture files are loaded relative to the `compliance/fixtures/` dir
 * (resolved from this package's install location), then served as
 * data-URLs to the adapter. For adapters that can't consume data-URLs,
 * a future `BaseUrl` injection hook will let the runner point at a local
 * HTTP server instead.
 */
export async function runCompliance(
  adapter: ComplianceAdapter,
  specs: ComplianceSpec[],
): Promise<ComplianceReport> {
  const results: ComplianceResult[] = [];
  for (const spec of specs) {
    const html = loadFixture(spec);
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    try {
      const state = await adapter.snapshot(url);
      const failures = evaluate(state, spec.expectations);
      const result: ComplianceResult = {
        name: spec.name,
        pass: failures.length === 0,
        failures,
      };
      if (failures.length > 0) result.state = state;
      results.push(result);
    } catch (err) {
      results.push({
        name: spec.name,
        pass: false,
        failures: [`adapter.snapshot threw: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  const passed = results.filter((r) => r.pass).length;
  return {
    adapter: adapter.name,
    results,
    summary: { total: results.length, passed, failed: results.length - passed },
  };
}

function loadFixture(spec: ComplianceSpec): string {
  if (spec.fixture.kind === "inline") return spec.fixture.html;
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturePath = resolve(here, "..", "fixtures", spec.fixture.path);
  return readFileSync(fixturePath, "utf8");
}

/**
 * Load a set of spec JSON files shipped with this package. Each file is
 * expected to conform to `ComplianceSpec` (with `fixture: { kind: "file",
 * path: <relative> }` referencing a fixture under `fixtures/`).
 */
export function loadBundledSpecs(): ComplianceSpec[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const specsDir = resolve(here, "..", "specs");
  // v0.1 MVP: hand-enumerated list covering every widget type with a
  // detector in @bap-protocol/core. Widgets declared in the spec but
  // without a v0.1 detector (menu, tabs, accordion, tooltip) are not
  // represented here — adding fixtures for them would surface
  // false-positive failures until v0.2 ships the detectors.
  const names = [
    "slider.json",
    "stepper.json",
    "combobox.json",
    "listbox.json",
    "radiogroup.json",
    "checkboxgroup.json",
    "toggleswitch.json",
    "fileupload.json",
    "datepicker.json",
    "daterange-picker.json",
    "dialog.json",
  ];
  return names.map((n) => JSON.parse(readFileSync(resolve(specsDir, n), "utf8")) as ComplianceSpec);
}
