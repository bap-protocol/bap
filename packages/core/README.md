# @bap-protocol/core

Reference implementation of the Browser Agent Protocol.

Exposes a single `Session` that can capture `BrowserState`, dispatch `Action`s, and compute `StateDiff` between snapshots. Uses Playwright as the transport for v0.1; a CDP-direct transport is planned for v0.2.

## Status

Pre-alpha. The package compiles but has no functional extraction or dispatch yet — that work begins in Phase 2 (W4).

## Planned shape

```ts
import { Session } from "@bap-protocol/core";

const session = await Session.launch({ headless: true });
await session.goto("https://example.com");

const state = await session.snapshot();
const result = await session.dispatch({
  type: "click",
  target: { nodeId: "n17", frameId: "main" },
});
const diff = await session.diff(state);

await session.close();
```
