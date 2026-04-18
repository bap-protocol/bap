# Contributing to BAP

BAP is in pre-alpha. The most valuable contribution today is **feedback on the spec RFCs**, not code.

## Spec feedback

Open a GitHub Discussion or issue referencing the RFC (e.g. "RFC 0001: unclear handling of shadow DOM"). Concrete questions and real-world counterexamples move things forward; abstract suggestions usually don't.

## Code contributions

We accept PRs once an RFC is finalized. Before then, implementation details may shift.

### Local development

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Tests and CLI launch a real Chrome via `chrome-launcher`, which auto-discovers a system installation (Chrome, Chromium, or Edge). Install one of those if you don't have it already; no extra browser binary download step is needed.

### Project structure

- `spec/` — protocol RFCs in Markdown
- `packages/spec/` — JSON Schemas + TypeScript types
- `packages/core/` — reference implementation (functional)
- `packages/cli/` — command-line tool: `bap inspect`, `bap act` (functional)
- `packages/compliance/` — conformance test suite (planned, Phase 3)

### Principles

1. **Schema before code.** No feature ships without an RFC. Breaking schema changes bump the protocol version.
2. **Transport-agnostic.** The spec never mentions CDP, WebDriver, or any specific transport. Only `core/src/transport/` knows those exist.
3. **Deterministic where possible.** Same input, same output. Timing-dependent fields are explicitly marked.
4. **Testable from outside.** Compliance is measured against the conformance suite, not internal unit tests.
5. **No site-specific or language-specific hacks.** Every solution must generalize across sites and locales.

### Commit style

Conventional Commits. Examples:

- `feat(spec): add focus tracking to BrowserState`
- `fix(core): handle detached nodes in StateDiff`
- `docs(rfc-0002): clarify Action idempotency`

## Governance

Until v1.0, maintainers decide directly. After v1.0, spec changes go through an RFC process with public discussion.

## License

By contributing, you agree your contributions are licensed under the MIT license.
