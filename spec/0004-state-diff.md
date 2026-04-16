# RFC 0004 — `StateDiff`

Status: **draft**
Protocol version: `0.1`

## Motivation

After every `Action`, an agent needs to know *what changed*, not re-read the entire `BrowserState`. Re-reading is:

- **Wasteful of tokens.** A typical snapshot is 5–50 KB of JSON. A diff is usually < 1 KB.
- **Lossy for reasoning.** "The button label changed from 'Save' to 'Saving…'" is a signal the agent can act on; "here is a new 40 KB blob" is not.
- **Hostile to replay.** Deterministic diffs let tooling reconstruct a session step-by-step.

`StateDiff` is the canonical shape for "what changed between two `BrowserState` snapshots."

## Schema

```ts
interface StateDiff {
  version: string;
  /** Capture timestamp of the before-state. */
  from: string;
  /** Capture timestamp of the after-state. */
  to: string;
  changes: Change[];
}

type Change =
  | NodeAddedChange
  | NodeRemovedChange
  | NodeModifiedChange
  | WidgetAddedChange
  | WidgetRemovedChange
  | WidgetModifiedChange
  | FocusChangedChange
  | UrlChangedChange
  | TitleChangedChange
  | OverlayAppearedChange
  | OverlayDismissedChange
  | ViewportChangedChange;

interface NodeAddedChange {
  kind: "node-added";
  node: Node;
}

interface NodeRemovedChange {
  kind: "node-removed";
  nodeId: string;
  frameId: string;
}

interface NodeModifiedChange {
  kind: "node-modified";
  nodeId: string;
  frameId: string;
  /** Only the fields that changed. Dot-paths for nested fields (e.g. "state.disabled"). */
  fields: Record<string, unknown>;
}

interface WidgetAddedChange {
  kind: "widget-added";
  widget: Widget;
}

interface WidgetRemovedChange {
  kind: "widget-removed";
  widgetId: string;
}

interface WidgetModifiedChange {
  kind: "widget-modified";
  widgetId: string;
  fields: Record<string, unknown>;
}

interface FocusChangedChange {
  kind: "focus-changed";
  from?: NodeRef;
  to?: NodeRef;
}

interface UrlChangedChange {
  kind: "url-changed";
  from: string;
  to: string;
}

interface TitleChangedChange {
  kind: "title-changed";
  from: string;
  to: string;
}

interface OverlayAppearedChange {
  kind: "overlay-appeared";
  overlay: Overlay;
}

interface OverlayDismissedChange {
  kind: "overlay-dismissed";
  nodeId: string;
}

interface ViewportChangedChange {
  kind: "viewport-changed";
  /** Only the viewport fields that changed. */
  fields: Partial<Viewport>;
}
```

## Identity across snapshots

The hardest question the diff algorithm answers: *when is a node in snapshot A "the same" as a node in snapshot B?*

**BAP v0.1 rule:** two nodes are the same iff they have the same `locator.strategy` *and* `locator.value` *and* `frameId`. Implementations that wish to expose more sophisticated identity (structural similarity, prop hashing, React key tracking) are free to do so, but the wire format is stable-locator-based.

Consequences:

- A node whose locator changes (e.g. a `testid` rewritten, an XPath invalidated by DOM reshuffling) appears in the diff as one `node-removed` + one `node-added`. Consumers interested in finer-grained tracking are expected to pair them heuristically on their side.
- Widgets have stable IDs per (frameId, anchor-locator). A widget whose anchor node survives but whose internals mutate emits `widget-modified`, not removed/added.

Future versions may introduce a `node-moved` change kind if the simple rule proves insufficient.

## Determinism

The diff algorithm is deterministic: given two `BrowserState` values A and B, `diff(A, B)` yields the same `StateDiff` on every run. Non-deterministic inputs (timestamps, generated IDs) must be normalized before diffing, or excluded from diff consideration entirely.

Specifically, the following fields never appear as changes:

- `capturedAt` timestamps on either state
- `metadata.timezone` (environmental)
- Any field not part of the normative schema

## Size

Implementations must prefer a `StateDiff` over a full `BrowserState` snapshot when returning `ActionResult`, unless:

- The diff would contain more changes than the after-state has nodes (i.e. a full re-render — cheaper to ship the snapshot), or
- A cross-origin navigation occurred, making before/after node identity meaningless.

In those cases, the `ActionResult` carries `snapshot` instead of `diff`.

## Example

Before: a form with an empty email field and a "Sign in" button, no dialog.
After: the email field has a value; a dialog has appeared claiming the email is invalid.

```json
{
  "version": "0.1",
  "from": "2026-04-16T10:12:44.123Z",
  "to": "2026-04-16T10:12:44.287Z",
  "changes": [
    {
      "kind": "node-modified",
      "nodeId": "n7",
      "frameId": "main",
      "fields": { "value": "not-an-email", "state.invalid": true }
    },
    {
      "kind": "overlay-appeared",
      "overlay": {
        "nodeId": "n42",
        "type": "modal",
        "blocking": true
      }
    },
    {
      "kind": "widget-added",
      "widget": {
        "id": "w3",
        "type": "dialog",
        "nodeIds": ["n42", "n43", "n44"],
        "state": { "open": true, "modal": true, "title": "Invalid email" },
        "hints": {}
      }
    }
  ]
}
```

## Open questions

1. **Change ordering.** Are changes within a diff ordered, and does the order carry meaning? *Current leaning: order is implementation-defined but stable per-run; consumers must not rely on ordering semantics.*
2. **Nested field paths.** Are dot-paths the right encoding, or should nested modifications use full object replacement? *Current leaning: dot-paths for `node-modified` and `widget-modified`; they compress common cases well.*
3. **Batched diffs.** Can a single `StateDiff` span *more than two* snapshots (for replay compression)? *Defer to v1.1.*
4. **Diff invertibility.** Should it be possible to apply `diff(A, B)` to B and get A back? *Tempting for replay, but complicates the schema; v0.1 does not guarantee invertibility.*
5. **Virtual DOM changes.** When a framework re-renders a large subtree with only cosmetic changes, the diff may be noisy. *Implementations should suppress no-op changes; the wire format does not formalize "noise suppression."*

## Non-goals

- Visual diff (before/after pixels). Out of scope.
- Timeline/video reconstruction. Sentinel Cloud concern.
- Diff compression beyond the structural changes above.
- Custom change kinds. v0.1 enumerates all permissible kinds.
