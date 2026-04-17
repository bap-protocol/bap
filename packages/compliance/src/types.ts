import type { BrowserState, OverlayType, WidgetType } from "@bap-protocol/spec";

/**
 * Adapter: how the compliance suite talks to an implementation under test.
 * Any BAP-conforming implementation — in any language, behind any transport —
 * can plug in by exposing a single `snapshot(url) => BrowserState` function.
 */
export interface ComplianceAdapter {
  name: string;
  snapshot(url: string): Promise<BrowserState>;
  close?(): Promise<void>;
}

/**
 * A declarative expectation for one fixture. The runner loads the fixture,
 * snapshots it via the adapter, and checks each expectation. Expectations
 * are partial: unset fields are not checked.
 */
export interface ComplianceSpec {
  /** Human-readable name for the report. */
  name: string;
  /** Either inline HTML or a path to a .html file under `fixtures/`. */
  fixture: { kind: "inline"; html: string } | { kind: "file"; path: string };
  expectations: Expectations;
}

export interface Expectations {
  widgets?: WidgetExpectation[];
  minNodes?: number;
  maxNodes?: number;
  overlays?: { type: OverlayType; blocking?: boolean }[];
  focus?: { role?: string; name?: string } | null;
  /** Expected title (exact match). */
  title?: string;
}

export interface WidgetExpectation {
  type: WidgetType;
  /** Partial state match — only listed fields are compared. */
  state?: Record<string, unknown>;
  /** Partial hints match. */
  hints?: Record<string, unknown>;
}

export interface ComplianceResult {
  name: string;
  pass: boolean;
  failures: string[];
  state?: BrowserState;
}

export interface ComplianceReport {
  adapter: string;
  results: ComplianceResult[];
  summary: { total: number; passed: number; failed: number };
}
