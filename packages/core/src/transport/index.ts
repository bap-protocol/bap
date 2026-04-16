import type { Action, ActionResult, BrowserState } from "@bap-protocol/spec";

export interface Transport {
  goto(url: string, opts?: GotoOptions): Promise<void>;
  snapshot(): Promise<BrowserState>;
  dispatch(action: Action, lastState: BrowserState): Promise<ActionResult>;
  close(): Promise<void>;
}

export interface TransportLaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
}

export interface GotoOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}
