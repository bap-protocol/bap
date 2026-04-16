import type { BrowserState } from "@bap-protocol/spec";

export interface Transport {
  goto(url: string, opts?: GotoOptions): Promise<void>;
  snapshot(): Promise<BrowserState>;
  close(): Promise<void>;
}

export interface TransportLaunchOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
}

export interface GotoOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}
