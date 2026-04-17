import { Session } from "@bap-protocol/core";
import type { BrowserState } from "@bap-protocol/spec";
import type { ComplianceAdapter } from "./types.js";

/**
 * Default adapter: wraps `@bap-protocol/core`'s `Session`. Use this when
 * running the suite against the reference implementation. External
 * implementations (Python, Rust, other transports) implement
 * `ComplianceAdapter` directly without depending on this file.
 */
export async function createDefaultAdapter(): Promise<ComplianceAdapter> {
  const session = await Session.launch({ headless: true });
  return {
    name: "@bap-protocol/core",
    async snapshot(url: string): Promise<BrowserState> {
      await session.goto(url);
      return session.snapshot();
    },
    async close(): Promise<void> {
      await session.close();
    },
  };
}
