# Contributing to BAP

BAP is in pre-alpha. The most valuable contribution today is **feedback on the spec RFCs**, not code.

## Spec feedback

Open a GitHub Discussion or issue referencing the RFC (e.g. "RFC 0001: unclear handling of shadow DOM"). Concrete questions and real-world counterexamples move things forward; abstract suggestions usually don't.

## Code contributions

We accept PRs once an RFC is finalized. Before then, implementation details may shift.

### Local development

```bash
pnpm install
pnpm build
pnpm test
```

### Project structure

- `spec/` — protocol RFCs in Markdown
- `packages/spec/` — JSON Schemas + generated TypeScript types
- `packages/core/` — reference implementation
- `packages/compliance/` — conformance test suite (planned)
- `packages/cli/` — command-line tool (planned)

### Principles

1. **Schema before code.** No feature ships without an RFC. Breaking schema changes bump the protocol version.
2. **Transport-agnostic.** The spec never mentions Playwright, CDP, or WebDriver. Only `core/src/transport/` knows those exist.
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
