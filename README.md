# Browser Agent Protocol (BAP)

The open protocol for AI agents operating web browsers.

Status: `pre-alpha` · Spec version: `0.1-draft` · Not yet published

---

## 30-second pitch

Sentinel, the reference agent built on BAP, runs a real Amazon purchase flow in ~100 seconds at $0.003 per run using the same LLM other frameworks use. On the same flow, Stagehand times out after 5 minutes. Same prompt. Same model. Same network.

The difference is not the LLM — it is the layer between the agent and the browser. BAP is that layer, open-sourced so you can build on it.

```bash
npx bap-protocol demo amazon    # coming Phase 3 (W10)
```

## Why it exists

Every agent framework today — browser-use, Stagehand, Skyvern, in-house stacks — invents its own schema for "what the agent sees" and "what the agent does." None interoperate. None are stable. None are documented.

That means:

- You can't benchmark one agent against another on equal footing.
- You can't swap out the browser layer when you outgrow a framework.
- Every new agent builder reinvents widget detection, state extraction, and action dispatch from scratch.

BAP is the shared foundation that fixes this. What MCP is to tool use, BAP is to the browser.

## What BAP defines

Four primitives, documented as versioned RFCs:

- **[`BrowserState`](./spec/0001-browser-state.md)** — semantic, deterministic snapshot. Accessibility tree with first-class widget annotations. Not pixels.
- **[`Action`](./spec/0002-actions.md)** — structured commands. `click`, `fill`, `slide`, `pick-date`, `upload`, `scroll`, `wait`.
- **[`WidgetHint`](./spec/0003-widget-hints.md)** — sliders, date pickers, comboboxes, file uploads as first-class citizens, not DOM puzzles.
- **[`StateDiff`](./spec/0004-state-diff.md)** — deterministic change between snapshots. The primitive that makes reasoning and replay tractable.

## What BAP is not

- Not a browser. Reference implementation rides on Chromium via Playwright.
- Not an agent framework. Agents live *above* BAP.
- Not a testing library. Playwright already does that well.
- Not a hosted product. The protocol and reference implementation are MIT. Managed infrastructure is a separate commercial concern.

## How it compares

| | BAP | browser-use | Stagehand | Playwright |
|---|---|---|---|---|
| Open spec | ✓ | — | — | — |
| Widget-level semantics | ✓ | partial | partial | — |
| Deterministic state diffs | ✓ | — | — | — |
| Cross-framework portable | ✓ | — | — | ✓ |
| Agent-first API | ✓ | ✓ | ✓ | — |

## Packages

| Package | Purpose | Status |
|---|---|---|
| [`@bap-protocol/spec`](./packages/spec) | JSON Schemas + TypeScript types | functional |
| [`@bap-protocol/core`](./packages/core) | Reference implementation in TypeScript | scaffolding |
| `@bap-protocol/compliance` | Conformance test suite (MUI-based fixtures) | planned (W8) |
| `@bap-protocol/cli` | `npx bap-protocol inspect | act | demo` | planned (W10) |

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the public roadmap to v1.0.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Early feedback on the spec RFCs is the most valuable thing you can offer right now.

## License

MIT. See [`LICENSE`](./LICENSE).
