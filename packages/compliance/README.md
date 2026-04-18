# @bap-protocol/compliance

Conformance test suite for BAP implementations. Fixture-based, adapter-driven, transport-agnostic.

## Status

v0.1 complete — 15 fixtures, one per widget type in RFC 0001. All 15 pass against `@bap-protocol/core`.

| Widget | Detector | Fixture |
|---|---|---|
| `slider` | ✓ | ✓ |
| `stepper` | ✓ | ✓ |
| `combobox` | ✓ | ✓ |
| `listbox` | ✓ | ✓ |
| `radiogroup` | ✓ | ✓ |
| `checkboxgroup` | ✓ | ✓ |
| `toggleswitch` | ✓ | ✓ |
| `fileupload` | ✓ | ✓ |
| `datepicker` | ✓ | ✓ |
| `daterange-picker` | ✓ | ✓ |
| `dialog` | ✓ | ✓ |
| `tabs` | ✓ | ✓ |
| `menu` | ✓ | ✓ |
| `accordion` | ✓ | ✓ |
| `tooltip` | ✓ | ✓ |

## How it works

1. A **spec** declares what BAP should extract from a given fixture: which widgets, what node counts, which overlays, whether focus is set.
2. A **fixture** is a tiny HTML file under `fixtures/`. Each fixture targets one widget or state pattern.
3. An **adapter** exposes a single `snapshot(url) => BrowserState` function. It's the only dependency on a concrete implementation.
4. The **runner** loads each spec, navigates the adapter to the fixture's data-URL, and evaluates the snapshot against the spec's expectations.

## Running the suite against the reference implementation

```ts
import { createDefaultAdapter, loadBundledSpecs, runCompliance } from "@bap-protocol/compliance";

const adapter = await createDefaultAdapter();
const report = await runCompliance(adapter, loadBundledSpecs());
await adapter.close?.();

console.log(report);
```

## Running against your own implementation

Implement `ComplianceAdapter`:

```ts
import type { ComplianceAdapter } from "@bap-protocol/compliance";

const myAdapter: ComplianceAdapter = {
  name: "my-impl",
  async snapshot(url) {
    // your code: launch a browser, navigate, emit a BAP BrowserState
    return browserStateFromMyImpl(url);
  },
};

await runCompliance(myAdapter, loadBundledSpecs());
```

Implementations in other languages/processes wrap the adapter in a small Node shim that shells out to the real impl.

## Writing a new spec

1. Drop an HTML fixture under `fixtures/<name>.html` — self-contained, no network dependencies.
2. Add `specs/<name>.json` with the expected `BrowserState` shape:
   ```json
   {
     "name": "human-readable name",
     "fixture": { "kind": "file", "path": "name.html" },
     "expectations": {
       "title": "...",
       "minNodes": 1,
       "widgets": [{ "type": "slider", "state": { "min": 0, "max": 100 } }]
     }
   }
   ```
3. Register the spec filename in `loadBundledSpecs()` in `src/runner.ts`.
4. Run `pnpm -F @bap-protocol/compliance test` — if the reference impl passes, the spec is production-ready.

## Design notes

- **Expectations are partial.** Only fields you list are compared. This keeps specs robust against implementation details (e.g. we don't lock down node counts tighter than necessary).
- **No fixture server.** Fixtures are embedded as data-URLs. Sufficient for v0.1; a local HTTP server hook is a v0.2 addition for adapters that can't consume data-URLs.
- **No cross-implementation diffing yet.** v0.1 only checks "does this adapter match the spec". Comparing two implementations against each other is a v0.2 capability.
