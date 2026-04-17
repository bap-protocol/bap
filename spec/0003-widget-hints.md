# RFC 0003 — `WidgetHint`

Status: **draft**
Protocol version: `0.1`

## Motivation

Modern web UIs are built from *widgets* — composite controls that span multiple DOM nodes and follow recognizable interaction patterns. A date picker is not a single `<input>`; it is an input plus an opener plus a calendar grid plus navigation controls. A slider is not just an element with `role="slider"`; it has a thumb, a track, min/max bounds, and keyboard semantics.

If `BrowserState` only exposed the flat node tree, every agent would have to rediscover "this is a slider" every turn, guess at its semantic state (what *is* the current value?), and invent its own dispatch strategy (drag? keyboard? aria attributes?).

BAP elevates widgets to first-class citizens:

- **Detection is centralized** in the implementation. Agents consume a typed `Widget` object directly.
- **State is structured.** A slider reports `{ min, max, value, step }`, not raw ARIA attributes the agent has to parse.
- **Hints carry dispatch strategy.** The implementation tells the action layer (and, transparently, the agent) *how* this widget should be manipulated, so the same `SlideAction` works across MUI, Ant Design, custom implementations.

## Widget catalog (v0.1)

Each widget type has a **state schema** (what the widget currently is) and a **hints schema** (how to interact with it).

### `slider`

```ts
interface SliderState {
  min: number;
  max: number;
  /** Single value or [start, end] for range sliders. */
  value: number | [number, number];
  step?: number;
  orientation?: "horizontal" | "vertical";
}

interface SliderHints {
  /** Ordered fill strategies the implementation will try for a SlideAction. */
  fillStrategies: ("aria-valuenow" | "keyboard" | "drag")[];
  /** Node ID of the thumb element(s), for transports that need to target it directly. */
  thumbNodeIds: string[];
}
```

### `datepicker`

```ts
interface DatepickerState {
  /** ISO-8601 date, or null if unset. */
  value: string | null;
  /** Inclusive bounds, if any. */
  min?: string;
  max?: string;
  /** True when the picker panel is currently open. */
  open: boolean;
}

interface DatepickerHints {
  /** Display format used by the input; hint only — BAP uses ISO internally. */
  displayFormat?: string;
  /** How the panel is revealed. */
  openTrigger: "click-input" | "click-icon" | "focus-input";
  /** Month navigation UI. */
  monthNavigation: "arrows" | "dropdowns" | "both";
  /** Locale hint for month/weekday labels. */
  locale?: string;
}
```

### `daterange-picker`

```ts
interface DaterangePickerState {
  start: string | null;
  end: string | null;
  min?: string;
  max?: string;
  open: boolean;
}

interface DaterangePickerHints extends DatepickerHints {
  /** True if start and end are picked on separate panels. */
  twoStep: boolean;
}
```

### `combobox` / `listbox`

```ts
interface ComboboxState {
  value: string | string[];
  /** May be absent if options are loaded dynamically. */
  options?: { value: string; label: string; nodeId?: string }[];
  multi: boolean;
  open: boolean;
}

interface ComboboxHints {
  searchable: boolean;
  /** When options are populated in the DOM. */
  optionsPopulatedOn: "always" | "open" | "type";
  /** Does the control accept free-form text outside the options list? */
  freeText: boolean;
}
```

### `menu`

```ts
interface MenuState {
  open: boolean;
  /** Visible items, if the menu is open. */
  items?: { label: string; nodeId: string; disabled?: boolean; submenu?: boolean }[];
}

interface MenuHints {
  /** How the menu is opened. */
  openTrigger: "click" | "hover" | "focus";
}
```

### `tabs` / `accordion`

```ts
interface TabsState {
  selected: string;
  items: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

interface AccordionState {
  expanded: string[];
  items: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

// Hints are empty for v0.1 — both are interacted with via ClickAction on the target item's nodeId.
```

### `fileupload`

```ts
interface FileuploadState {
  /** Current files attached to the control, by filename. Size/type not guaranteed available. */
  current: string[];
  multiple: boolean;
  /** MIME types or extensions the control accepts, if declared. */
  accept?: string[];
}

interface FileuploadHints {
  /** Primary dispatch strategy. */
  strategy: "input-change" | "drop-zone" | "hidden-input";
  /** If `drop-zone`, the node ID of the drop target. */
  dropZoneNodeId?: string;
}
```

### `radiogroup` / `checkboxgroup`

```ts
interface RadiogroupState {
  value: string | null;
  options: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

interface CheckboxgroupState {
  values: string[];
  options: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}
```

### `toggleswitch`

```ts
interface ToggleswitchState {
  checked: boolean;
}
```

### `stepper`

```ts
interface StepperState {
  value: number;
  min?: number;
  max?: number;
  step?: number;
}

interface StepperHints {
  /** Ordered fill strategies the implementation will try. */
  fillStrategies: ("fill-value" | "keyboard" | "buttons")[];
  /** Node IDs of the increment / decrement buttons if present. */
  incrementNodeId?: string;
  decrementNodeId?: string;
}
```

Guest-count pickers, quantity selectors, numeric filter fields. Detected via `role="spinbutton"` (covers both native `<input type="number">` and ARIA widgets). Custom steppers that expose as `button + display + button` surfaces are a v0.2 detection target.

### `dialog` / `tooltip`

```ts
interface DialogState {
  open: boolean;
  modal: boolean;
  title?: string;
  /** Node IDs of the dialog's action buttons (typically "OK", "Cancel"). */
  actionNodeIds?: string[];
}

interface TooltipState {
  visible: boolean;
  text?: string;
}
```

## Detection criteria

Implementations determine widget type from:

1. Explicit ARIA roles (`role="slider"`, `role="combobox"`, etc.)
2. Native HTML elements (`<input type="range">`, `<input type="date">`, `<select>`)
3. Framework-specific patterns (MUI, Ant, Chakra) — detected via data attributes and class-name heuristics, but *not* required for a valid implementation.

A node may belong to at most one widget. Ambiguous cases (e.g. an `<input type="date">` with a custom popup) must be resolved by the implementation deterministically — two runs on the same DOM must yield the same widget classification.

## Extensibility

Custom widget types are intentionally **not** part of v0.1. The catalog above covers the widgets that agents encounter on the overwhelming majority of real-world forms. A `custom` widget type with a free-form state bag may be added in v1.1 if adoption demands it.

## Open questions

1. **Virtualized list widgets.** Scrollable lists that render only visible rows (react-window, virtuoso) behave like a widget but are currently *not* in the catalog. *Add in v0.1 as `virtual-list`, or defer?*
2. **Rich text editors.** Contenteditable editors with formatting toolbars are ubiquitous but extremely heterogeneous. *Defer to v1.1; v0.1 treats them as plain textboxes.*
3. **Map widgets.** Out of scope for v0.1.
4. **Widget identity across snapshots.** When the DOM is rerendered but the semantic widget is "the same", is the `Widget.id` preserved? *Leaning: yes, stable per (frameId, anchor-locator); formally defined in RFC 0004.*

## Non-goals

- Visual styling information.
- Animation state.
- Rendering-layer details (transform, opacity).
- Accessibility compliance scoring (separate tool concern).

## Review questions

External maintainers: post responses as a GitHub Discussion on this RFC or open a PR with suggested edits.

1. **Missing widget.** Run through the last ten pages your agent touched — which composite control falls between BAP's current catalog and "just a bag of nodes"? Rich text editors, multi-select tag inputs, and virtualized lists are the usual candidates; others?
2. **Framework heuristics.** Detection for MUI / Ant Design / Chakra often needs data-attribute or class-name signals. Do you want those heuristics inside the reference implementation (pro: shared), or explicitly forbidden at the protocol layer (pro: no framework lock-in)?
3. **Widget identity across snapshots.** A widget's anchor node survives a re-render but its internals mutate — should `Widget.id` be preserved (so the diff emits `widget-modified`), or is widget-removed + widget-added cleaner for reasoning?
