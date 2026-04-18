import { launch as launchChrome, type LaunchedChrome } from "chrome-launcher";
import type { Action, ActionResult, BrowserState } from "@bap-protocol/spec";
import type { GotoOptions, Transport, TransportLaunchOptions } from "./index.js";
import { connectCDP, type CDPSession } from "./cdp-client.js";
import { extractBrowserStateWithBackendIds } from "../state/extract.js";
import { dispatchAction } from "../actions/dispatch.js";

interface TargetInfo {
  id: string;
  type: string;
  webSocketDebuggerUrl: string;
  url: string;
}

export class CDPTransport implements Transport {
  private backendIdByNodeId = new Map<string, number>();

  private constructor(
    private readonly chrome: LaunchedChrome,
    private readonly client: CDPSession,
  ) {}

  static async launch(opts: TransportLaunchOptions = {}): Promise<CDPTransport> {
    const viewport = opts.viewport ?? { width: 1280, height: 800 };
    const flags = [
      `--window-size=${viewport.width},${viewport.height}`,
      "--disable-features=Translate,OptimizationHints",
      "--no-first-run",
      "--no-default-browser-check",
    ];
    if (opts.headless ?? true) flags.push("--headless=new");

    const chrome = await launchChrome({ chromeFlags: flags });
    try {
      const targets = await fetchTargets(chrome.port);
      const page = targets.find((t) => t.type === "page");
      if (!page) throw new Error("No page target found in launched Chrome");
      const client = await connectCDP(page.webSocketDebuggerUrl);
      await Promise.all([
        client.send("Page.enable"),
        client.send("Runtime.enable"),
        client.send("DOM.enable"),
      ]);
      return new CDPTransport(chrome, client);
    } catch (err) {
      await chrome.kill();
      throw err;
    }
  }

  async goto(url: string, opts: GotoOptions = {}): Promise<void> {
    const waitUntil = opts.waitUntil ?? "load";
    const eventName =
      waitUntil === "domcontentloaded"
        ? "Page.domContentEventFired"
        : waitUntil === "networkidle"
          ? "Page.lifecycleEvent"
          : "Page.loadEventFired";

    const done = new Promise<void>((resolve, reject) => {
      const off = this.client.on(
        eventName as "Page.loadEventFired",
        (payload) => {
          if (waitUntil === "networkidle") {
            const name = (payload as { name?: string }).name;
            if (name !== "networkIdle") return;
          }
          off();
          resolve();
        },
      );
      setTimeout(() => {
        off();
        reject(new Error(`goto(${url}) timed out waiting for ${eventName}`));
      }, 30_000).unref?.();
    });

    await this.client.send("Page.navigate", { url });
    await done;
  }

  async snapshot(): Promise<BrowserState> {
    const { state, backendIdByNodeId } = await extractBrowserStateWithBackendIds(this.client);
    this.backendIdByNodeId = backendIdByNodeId;
    return state;
  }

  async dispatch(action: Action, lastState: BrowserState): Promise<ActionResult> {
    return dispatchAction(
      { client: this.client, backendIdByNodeId: this.backendIdByNodeId },
      action,
      lastState,
    );
  }

  async close(): Promise<void> {
    await this.client.close().catch(() => {});
    await this.chrome.kill();
  }
}

async function fetchTargets(port: number): Promise<TargetInfo[]> {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  if (!res.ok) throw new Error(`CDP /json returned ${res.status}`);
  return (await res.json()) as TargetInfo[];
}
