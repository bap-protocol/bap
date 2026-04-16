# RFC 0001 — `BrowserState`

Status: **draft**
Protocol version: `0.1`

## Motivation

An AI agent operating a browser needs a snapshot of "what is on the page right now" that is:

1. **Semantic** — describes roles, names, values, and states, not pixels.
2. **Interaction-focused** — optimized for deciding what to click, fill, or read, not for rendering.
3. **Deterministic** — the same page in the same state yields the same snapshot, so diffs and replays are meaningful.
4. **Transport-agnostic** — captures what the page *is*, not how it was captured (CDP, Playwright, WebDriver).

Existing formats fall short on at least one axis:

- **DOM dumps** are too low-level and non-deterministic (style, layout, generated attributes).
- **Accessibility trees** are close but lack widget-level semantics and lose form-state context.
- **Framework-specific JSON** (browser-use, Stagehand) is not interoperable or stable.

`BrowserState` is the BAP-defined snapshot. Every agent, regardless of framework or transport, consumes the same shape.

## Schema

```ts
interface BrowserState {
  /** Protocol version, e.g. "0.1" */
  version: string;

  /** ISO-8601 timestamp when the snapshot was captured */
  capturedAt: string;

  /** Top-level frame URL */
  url: string;

  /** Document title */
  title: string;

  viewport: Viewport;

  /** All frames in the page, main frame first */
  frames: Frame[];

  /** Flat list of semantic nodes across all frames */
  nodes: Node[];

  /** High-level widgets detected in this snapshot */
  widgets: Widget[];

  /** Currently focused node, if any */
  focus?: NodeRef;

  /** Modals, toasts, tooltips, menus that may block or alter interaction */
  overlays: Overlay[];

  /** Environment metadata */
  metadata: Metadata;
}

interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

interface Frame {
  id: string;
  url: string;
  parentFrameId?: string;
}

interface Node {
  /** Stable within a snapshot; not guaranteed stable across snapshots. */
  id: string;

  /** ARIA role or HTML semantic role (e.g. "button", "textbox", "link") */
  role: string;

  /** Accessible name, if any */
  name?: string;

  /** Accessible description, if any */
  description?: string;

  /** Current value (inputs, selects, etc.) */
  value?: string;

  interactable: boolean;
  editable: boolean;

  state: NodeState;

  /** Bounding rect, if the node has layout */
  rect?: Rect;

  parentId?: string;
  childIds: string[];
  frameId: string;

  /** How to find this node again via transport; not part of semantic identity. */
  locator: Locator;
}

interface NodeState {
  disabled?: boolean;
  checked?: boolean | "mixed";
  expanded?: boolean;
  selected?: boolean;
  required?: boolean;
  invalid?: boolean;
  readonly?: boolean;
  focused?: boolean;
  hidden?: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  inViewport: boolean;
}

interface Locator {
  strategy: "id" | "testid" | "role-name" | "xpath" | "css";
  value: string;
}

interface Widget {
  id: string;
  type: WidgetType;

  /** Nodes comprising this widget. First entry is typically the anchor/root. */
  nodeIds: string[];

  /** Widget-specific state (e.g. min/max/current for a slider). */
  state: Record<string, unknown>;

  /** Widget-specific hints for action dispatch (see RFC 0003). */
  hints: Record<string, unknown>;
}

type WidgetType =
  | "slider"
  | "datepicker"
  | "daterange-picker"
  | "combobox"
  | "listbox"
  | "menu"
  | "tabs"
  | "accordion"
  | "fileupload"
  | "radiogroup"
  | "checkboxgroup"
  | "toggleswitch"
  | "dialog"
  | "tooltip";

interface Overlay {
  nodeId: string;
  type: "modal" | "toast" | "tooltip" | "menu";
  /** True if the overlay blocks interaction with everything beneath it. */
  blocking: boolean;
}

interface NodeRef {
  nodeId: string;
  frameId: string;
}

interface Metadata {
  userAgent: string;
  timezone: string;
  language: string;
}
```

## Principles

### What belongs in `BrowserState`

- Anything an agent needs to **decide its next action**.
- Anything an agent needs to **understand the outcome** of its last action.
- Anything a diff consumer needs to **recognize change** between snapshots.

### What does not belong

- Pixel data, screenshots, canvas contents. *(Out of scope for v1.0; may appear in a separate `BrowserPerception` RFC later.)*
- Computed CSS styles. *(Leaked rendering detail; not part of semantics.)*
- Raw HTML. *(Too unstable; provides no interoperability.)*
- Network request logs. *(Out of scope; see future `NetworkState` RFC.)*

## Determinism

The same page, rendered in the same viewport with the same DOM, must produce the same `BrowserState` modulo explicitly non-deterministic fields:

- `capturedAt` (timestamp)
- `metadata.timezone` if the environment varies
- Node `id` values — stable within a snapshot, but the transport may choose any assignment strategy

Implementations must not include style hashes, generated React keys, framework-specific attributes, or other fields that break deterministic comparison.

## Example

```json
{
  "version": "0.1",
  "capturedAt": "2026-04-16T10:12:44.123Z",
  "url": "https://example.com/login",
  "title": "Sign in · Example",
  "viewport": { "width": 1280, "height": 800, "devicePixelRatio": 1, "scrollX": 0, "scrollY": 0 },
  "frames": [{ "id": "main", "url": "https://example.com/login" }],
  "nodes": [
    {
      "id": "n1",
      "role": "textbox",
      "name": "Email",
      "value": "",
      "interactable": true,
      "editable": true,
      "state": { "required": true },
      "rect": { "x": 100, "y": 200, "width": 280, "height": 40, "inViewport": true },
      "childIds": [],
      "frameId": "main",
      "locator": { "strategy": "role-name", "value": "textbox:Email" }
    },
    {
      "id": "n2",
      "role": "button",
      "name": "Sign in",
      "interactable": true,
      "editable": false,
      "state": {},
      "rect": { "x": 100, "y": 300, "width": 280, "height": 40, "inViewport": true },
      "childIds": [],
      "frameId": "main",
      "locator": { "strategy": "role-name", "value": "button:Sign in" }
    }
  ],
  "widgets": [],
  "overlays": [],
  "metadata": { "userAgent": "...", "timezone": "Europe/Berlin", "language": "en-US" }
}
```

## Open questions

1. **Shadow DOM** — do closed shadow roots appear as opaque nodes, or do we require open shadow DOM? *Current leaning: open shadow DOM only for v0.1; closed shadow roots appear as single opaque nodes with `role: "shadow-host"`.*
2. **Text nodes** — do we surface bare text, or only text attached to semantic roles? *Current leaning: only text reachable via accessible name or description.*
3. **Canvas content** — opaque for v1.0. Agents that need canvas-aware behavior use vision fallback outside BAP.
4. **Iframe cross-origin** — can the protocol describe frames it cannot introspect? *Current leaning: yes, as `frame` nodes with a single `role: "frame"` child and a `state.inaccessible: true` flag.*
5. **Virtualized lists** — the DOM shows 20 rows, the user sees "1 of 1000". Do we expose scroll-based virtualization as a first-class concept? *Current leaning: no for v0.1; a widget type `virtual-list` may come in v1.1.*
6. **Locator stability** — how aggressively should implementations prefer `testid` over `role-name`? *Under discussion.*

## Non-goals

- Perfect fidelity to visual layout. A pixel-diff tool is a different product.
- Capturing user intent or reasoning. That lives above BAP, in the agent.
- Abstracting over different user-interaction models (keyboard vs. pointer vs. touch). BAP describes what exists; `Action` (RFC 0002) describes what to do.

## References

- W3C ARIA 1.2 — basis for role and state vocabulary.
- Chrome DevTools Protocol `Accessibility` domain — inspiration for node extraction.
- MCP (Model Context Protocol) — structural inspiration for a transport-agnostic, JSON-Schema-based interface.
