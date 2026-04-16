# RFC 0002 — `Action`

Status: **draft**
Protocol version: `0.1`

## Motivation

An agent's turn consists of reading a `BrowserState` (RFC 0001) and emitting an action that advances the task. The action language must be:

1. **Structured** — discriminated by type, validated against a schema, never free-form strings.
2. **Intent-level, not event-level** — "click this button" is an action; "mouseDown at (x, y) then mouseUp" is transport detail.
3. **Widget-aware** — "set this slider to 250" targets the widget, not a collection of mouse events.
4. **Composable with diffs** — every action produces an `ActionResult` that carries a `StateDiff` (RFC 0004), so the agent's next turn starts from a known delta instead of a re-capture.

## Schema

```ts
type Action =
  | NavigateAction
  | ClickAction
  | FillAction
  | SelectAction
  | SlideAction
  | PickDateAction
  | UploadAction
  | ScrollAction
  | WaitAction;

interface ActionBase {
  /** Client-assigned ID for correlation with results. Echoed back in ActionResult. */
  id?: string;
  /** Action-specific timeout. Implementations define defaults per action type. */
  timeoutMs?: number;
}

interface NavigateAction extends ActionBase {
  type: "navigate";
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

interface ClickAction extends ActionBase {
  type: "click";
  target: NodeRef;
  button?: "left" | "right" | "middle";
  /** 1 = click (default), 2 = dblclick */
  clickCount?: 1 | 2;
  modifiers?: Modifier[];
}

interface FillAction extends ActionBase {
  type: "fill";
  target: NodeRef;
  value: string;
  /** Clear existing content first. Default: true. */
  clear?: boolean;
  /** Press Enter after filling. Default: false. */
  submit?: boolean;
}

interface SelectAction extends ActionBase {
  type: "select";
  /** A listbox, combobox, or menu — node or widget reference. */
  target: NodeRef | WidgetRef;
  /** Option values or labels; resolution strategy is implementation-defined but must be deterministic. */
  values: string[];
}

interface SlideAction extends ActionBase {
  type: "slide";
  target: WidgetRef;
  /** Single value, or [start, end] for range sliders. */
  value: number | [number, number];
}

interface PickDateAction extends ActionBase {
  type: "pick-date";
  target: WidgetRef;
  /** ISO-8601 date for single picker, {start, end} for range. */
  date: string | { start: string; end: string };
}

interface UploadAction extends ActionBase {
  type: "upload";
  target: NodeRef | WidgetRef;
  /** Transport-resolved file paths. Paths not readable by the transport raise `invalid-value`. */
  files: string[];
}

interface ScrollAction extends ActionBase {
  type: "scroll";
  /** Omit target to scroll the window. */
  target?: NodeRef;
  to:
    | "top"
    | "bottom"
    | { x: number; y: number }
    | { delta: { x: number; y: number } };
}

interface WaitAction extends ActionBase {
  type: "wait";
  condition:
    | { kind: "navigation" }
    | { kind: "node-appears"; locator: Locator }
    | { kind: "node-disappears"; locator: Locator }
    | { kind: "network-idle"; idleMs?: number }
    | { kind: "duration"; ms: number };
}

type Modifier = "alt" | "control" | "meta" | "shift";

interface WidgetRef {
  widgetId: string;
}

interface NodeRef {
  nodeId: string;
  frameId: string;
}
```

### Result

```ts
interface ActionResult {
  /** Echo of the Action.id, if provided. */
  id?: string;
  success: boolean;
  error?: ActionError;
  /** Either a diff since the pre-action state or a full snapshot; never both. */
  diff?: StateDiff;
  snapshot?: BrowserState;
  /** Wall-clock duration from dispatch to completion. */
  durationMs: number;
}

interface ActionError {
  code: ActionErrorCode;
  message: string;
  /** True if a retry with the same payload could plausibly succeed. */
  retryable: boolean;
  /** Optional diagnostic payload; implementation-specific. */
  data?: Record<string, unknown>;
}

type ActionErrorCode =
  | "target-not-found"
  | "target-not-interactable"
  | "target-disabled"
  | "target-hidden"
  | "target-obscured"
  | "widget-type-mismatch"
  | "invalid-value"
  | "timeout"
  | "navigation-failed"
  | "transport-error"
  | "unknown";
```

## Principles

### Atomicity

An action is an atomic intent from the agent's perspective. If the implementation must perform a multi-step internal sequence (focus → clear → type → blur), partial failures roll back to `success: false` with a single `ActionError`. The agent never sees "half of a fill".

### Idempotency

Actions are **not** guaranteed idempotent. `click` on a "submit" button twice is two submissions, not one. However, implementations must not re-dispatch an action internally on transient failure without surfacing the retry to the caller via a distinct `ActionResult`.

### Target resolution

For `NodeRef` targets: the node must exist in the current state. If the DOM has mutated since the agent read its last snapshot, the implementation should attempt to re-resolve via `locator` before falling back to `target-not-found`.

For `WidgetRef` targets: the widget must exist and be of the correct type for the action. Passing a `slider` widget to `pick-date` yields `widget-type-mismatch`.

### Timeouts

Every action has a default timeout (implementation-defined, typically 30s). `timeoutMs` overrides. On timeout, the result is `success: false`, `code: "timeout"`, `retryable: true`.

### Post-action state

Every successful action returns *either* a `StateDiff` (preferred) *or* a full `BrowserState` snapshot. Implementations must prefer `StateDiff` for bandwidth and reasoning efficiency; full snapshots are a fallback for cases where the implementation cannot compute a meaningful diff (e.g. after cross-origin navigation).

## Example

```json
{
  "type": "fill",
  "id": "a-17",
  "target": { "nodeId": "n7", "frameId": "main" },
  "value": "alice@example.com",
  "submit": false,
  "timeoutMs": 5000
}
```

Result:

```json
{
  "id": "a-17",
  "success": true,
  "diff": {
    "version": "0.1",
    "changes": [
      { "kind": "node-modified", "nodeId": "n7", "fields": { "value": "alice@example.com" } }
    ]
  },
  "durationMs": 142
}
```

## Open questions

1. **Multi-target actions.** Should `click` accept an ordered list of targets for "click all checkboxes" ergonomics, or do we force callers to issue N actions? *Current leaning: single target only; batching is the agent's job.*
2. **Keyboard action.** Do we need a generic `press` action for arbitrary key sequences (Ctrl+A, Escape, Tab)? *Current leaning: yes in v0.2, not v0.1; v0.1 scope is form and widget interaction.*
3. **Hover.** Some menus only open on hover. Do we add `hover`, or rely on `wait` + implementation-level heuristics? *Open — probably `hover` in v0.2.*
4. **Custom wait conditions.** Should `wait` be extensible with custom predicates (e.g., "wait until this element's text matches regex")? *Current leaning: no in v0.1; add specific conditions as they prove necessary.*
5. **Dry-run.** Should actions support a `dryRun: true` flag that returns the expected diff without applying it? *Tempting for reasoning layers, but out of scope for v0.1 — cannot be implemented correctly for non-pure actions.*

## Non-goals

- Low-level input events (mouseDown, keyDown). Transport concern.
- Action recording/replay primitives. Sentinel Cloud concern.
- Multi-tab coordination. Out of scope for v0.1; one session = one focused page.
