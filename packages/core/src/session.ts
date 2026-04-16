import type { BrowserState } from "@bap-protocol/spec";
import { PlaywrightTransport } from "./transport/playwright.js";
import type { GotoOptions, Transport, TransportLaunchOptions } from "./transport/index.js";

export class Session {
  private constructor(private readonly transport: Transport) {}

  static async launch(opts: TransportLaunchOptions = {}): Promise<Session> {
    const transport = await PlaywrightTransport.launch(opts);
    return new Session(transport);
  }

  async goto(url: string, opts?: GotoOptions): Promise<void> {
    await this.transport.goto(url, opts);
  }

  async snapshot(): Promise<BrowserState> {
    return this.transport.snapshot();
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
