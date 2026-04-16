# BAP Specification

The Browser Agent Protocol is defined as a series of RFC-style Markdown documents. Each RFC is a versioned contract: a `v1.0` implementation is any system that produces and consumes data conforming to the JSON Schemas referenced here.

## RFC index

| Number | Title | Status |
|---|---|---|
| [0001](./0001-browser-state.md) | `BrowserState` — semantic snapshot | draft |
| [0002](./0002-actions.md) | `Action` — structured commands | stub |
| [0003](./0003-widget-hints.md) | `WidgetHint` — first-class widgets | stub |
| [0004](./0004-state-diff.md) | `StateDiff` — deterministic diffs | stub |

## Lifecycle

- **stub** — placeholder, awaiting drafting
- **draft** — under active authoring, schemas may change daily
- **review** — externally reviewed, breaking changes need a version bump
- **final** — frozen for the current protocol version

## Versioning

BAP follows SemVer at the protocol level.

- Patch: clarifications, non-normative changes
- Minor: additive schema fields, new optional action types
- Major: breaking changes to existing fields or required semantics

Implementations must declare the protocol version they implement; clients must reject snapshots whose major version they do not support.
