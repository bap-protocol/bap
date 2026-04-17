import type { BrowserState, Widget } from "@bap-protocol/spec";
import type { Expectations, WidgetExpectation } from "./types.js";

/**
 * Evaluate a BrowserState against a set of expectations. Returns an array
 * of failure messages; empty array means the state matches.
 */
export function evaluate(state: BrowserState, exp: Expectations): string[] {
  const failures: string[] = [];

  if (exp.minNodes !== undefined && state.nodes.length < exp.minNodes) {
    failures.push(`expected at least ${exp.minNodes} nodes, got ${state.nodes.length}`);
  }
  if (exp.maxNodes !== undefined && state.nodes.length > exp.maxNodes) {
    failures.push(`expected at most ${exp.maxNodes} nodes, got ${state.nodes.length}`);
  }

  if (exp.title !== undefined && state.title !== exp.title) {
    failures.push(`expected title "${exp.title}", got "${state.title}"`);
  }

  if (exp.widgets) {
    for (const w of exp.widgets) {
      const match = findMatchingWidget(state.widgets, w);
      if (!match) {
        failures.push(`no widget matches ${JSON.stringify(w)}`);
      }
    }
  }

  if (exp.overlays) {
    for (const o of exp.overlays) {
      const match = state.overlays.find((a) => {
        if (a.type !== o.type) return false;
        if (o.blocking !== undefined && a.blocking !== o.blocking) return false;
        return true;
      });
      if (!match) failures.push(`no overlay matches ${JSON.stringify(o)}`);
    }
  }

  if (exp.focus === null && state.focus) {
    const node = state.nodes.find((n) => n.id === state.focus!.nodeId);
    failures.push(`expected no focus, got node ${JSON.stringify({ role: node?.role, name: node?.name })}`);
  } else if (exp.focus && typeof exp.focus === "object") {
    if (!state.focus) {
      failures.push(`expected focus ${JSON.stringify(exp.focus)}, but no node is focused`);
    } else {
      const node = state.nodes.find((n) => n.id === state.focus!.nodeId);
      if (exp.focus.role && node?.role !== exp.focus.role) {
        failures.push(`expected focused role "${exp.focus.role}", got "${node?.role}"`);
      }
      if (exp.focus.name && node?.name !== exp.focus.name) {
        failures.push(`expected focused name "${exp.focus.name}", got "${node?.name}"`);
      }
    }
  }

  return failures;
}

function findMatchingWidget(widgets: Widget[], exp: WidgetExpectation): Widget | undefined {
  return widgets.find((w) => {
    if (w.type !== exp.type) return false;
    if (exp.state && !partialMatch(w.state, exp.state)) return false;
    if (exp.hints && !partialMatch(w.hints, exp.hints)) return false;
    return true;
  });
}

function partialMatch(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(expected)) {
    if (!deepEqual(actual[k], v)) return false;
  }
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}
