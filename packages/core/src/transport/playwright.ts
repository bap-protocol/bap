import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { BrowserState } from "@bap-protocol/spec";
import type { GotoOptions, Transport, TransportLaunchOptions } from "./index.js";
import { extractBrowserState } from "../state/extract.js";

export class PlaywrightTransport implements Transport {
  private constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  static async launch(opts: TransportLaunchOptions = {}): Promise<PlaywrightTransport> {
    const browser = await chromium.launch({ headless: opts.headless ?? true });
    const context = await browser.newContext({
      viewport: opts.viewport ?? { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    return new PlaywrightTransport(browser, context, page);
  }

  async goto(url: string, opts: GotoOptions = {}): Promise<void> {
    await this.page.goto(url, { waitUntil: opts.waitUntil ?? "load" });
  }

  async snapshot(): Promise<BrowserState> {
    return extractBrowserState(this.page);
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
