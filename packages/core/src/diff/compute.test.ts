import { describe, expect, it } from "vitest";
import type { BrowserState, Node } from "@bap-protocol/spec";
import { computeDiff } from "./compute.js";

const EMPTY_METADATA = {
  userAgent: "test",
  timezone: "UTC",
  language: "en-US",
};

const EMPTY_VIEWPORT = {
  width: 1280,
  height: 800,
  devicePixelRatio: 1,
  scrollX: 0,
  scrollY: 0,
};

function makeState(overrides: Partial<BrowserState> = {}): BrowserState {
  return {
    version: "0.1",
    capturedAt: new Date().toISOString(),
    url: "https://example.com",
    title: "Example",
    viewport: EMPTY_VIEWPORT,
    frames: [{ id: "main", url: "https://example.com" }],
    nodes: [],
    widgets: [],
    overlays: [],
    metadata: EMPTY_METADATA,
    ...overrides,
  };
}

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: "n1",
    role: "button",
    childIds: [],
    frameId: "main",
    interactable: true,
    editable: false,
    state: {},
    locator: { strategy: "role-name", value: "button:Go" },
    ...overrides,
  };
}

describe("computeDiff", () => {
  it("reports no changes for identical states", () => {
    const a = makeState({ nodes: [makeNode({ name: "Go" })] });
    const b = makeState({
      capturedAt: a.capturedAt,
      nodes: [makeNode({ id: "n99", name: "Go" })], // different per-snapshot id, same locator
    });
    const diff = computeDiff(a, b);
    expect(diff.changes).toEqual([]);
  });

  it("detects url and title changes", () => {
    const a = makeState({ url: "https://a.com", title: "A" });
    const b = makeState({ url: "https://b.com", title: "B" });
    const diff = computeDiff(a, b);
    expect(diff.changes).toContainEqual({
      kind: "url-changed",
      from: "https://a.com",
      to: "https://b.com",
    });
    expect(diff.changes).toContainEqual({
      kind: "title-changed",
      from: "A",
      to: "B",
    });
  });

  it("detects node-added and node-removed by locator key", () => {
    const before = makeState({
      nodes: [makeNode({ id: "n1", name: "Go" })],
    });
    const after = makeState({
      nodes: [
        makeNode({ id: "n1", name: "Go" }),
        makeNode({
          id: "n2",
          name: "Cancel",
          locator: { strategy: "role-name", value: "button:Cancel" },
        }),
      ],
    });
    const diff = computeDiff(before, after);
    expect(diff.changes.filter((c) => c.kind === "node-added")).toHaveLength(1);
    expect(diff.changes.filter((c) => c.kind === "node-removed")).toHaveLength(0);
  });

  it("detects modified node fields as dot-paths", () => {
    const before = makeState({
      nodes: [makeNode({ id: "n1", name: "Go", value: "" })],
    });
    const after = makeState({
      nodes: [
        makeNode({
          id: "n1",
          name: "Go",
          value: "hello",
          state: { focused: true },
        }),
      ],
    });
    const diff = computeDiff(before, after);
    const mods = diff.changes.filter((c) => c.kind === "node-modified");
    expect(mods).toHaveLength(1);
    const mod = mods[0]!;
    expect(mod.fields).toMatchObject({ value: "hello", "state.focused": true });
  });

  it("does not emit node-modified when nothing changed", () => {
    const n = makeNode({ name: "Go", value: "x" });
    const before = makeState({ nodes: [n] });
    const after = makeState({ nodes: [{ ...n, id: "n777" }] });
    const diff = computeDiff(before, after);
    expect(diff.changes.filter((c) => c.kind === "node-modified")).toHaveLength(0);
  });
});
