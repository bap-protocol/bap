import type { Action, ActionResult, BrowserState, StateDiff } from "@bap-protocol/spec";
import { PROTOCOL_VERSION } from "@bap-protocol/spec";
import { CDPTransport } from "./transport/cdp.js";
import type { GotoOptions, Transport, TransportLaunchOptions } from "./transport/index.js";
import { computeDiff } from "./diff/compute.js";

export class Session {
  private lastState: BrowserState | null = null;

  private constructor(private readonly transport: Transport) {}

  static async launch(opts: TransportLaunchOptions = {}): Promise<Session> {
    const transport = await CDPTransport.launch(opts);
    return new Session(transport);
  }

  async goto(url: string, opts?: GotoOptions): Promise<void> {
    await this.transport.goto(url, opts);
  }

  async snapshot(): Promise<BrowserState> {
    const state = await this.transport.snapshot();
    this.lastState = state;
    return state;
  }

  async dispatch(action: Action): Promise<ActionResult> {
    if (!this.lastState) {
      return {
        success: false,
        error: {
          code: "target-not-found",
          message: "dispatch() called before snapshot() — no state to resolve targets against",
          retryable: false,
        },
        durationMs: 0,
      };
    }
    return this.transport.dispatch(action, this.lastState);
  }

  /**
   * Deterministic diff between two snapshots. Identity is locator-keyed across
   * snapshots; see RFC 0004.
   */
  diff(before: BrowserState, after: BrowserState): StateDiff {
    return computeDiff(before, after);
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

export { PROTOCOL_VERSION };
