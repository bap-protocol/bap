import type { BrowserState, Locator, NodeRef } from "./browser-state.js";
import type { StateDiff } from "./state-diff.js";

export type Action =
  | NavigateAction
  | ClickAction
  | FillAction
  | SelectAction
  | SlideAction
  | PickDateAction
  | UploadAction
  | ScrollAction
  | WaitAction;

export interface ActionBase {
  id?: string;
  timeoutMs?: number;
}

export interface NavigateAction extends ActionBase {
  type: "navigate";
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

export interface ClickAction extends ActionBase {
  type: "click";
  target: NodeRef;
  button?: "left" | "right" | "middle";
  clickCount?: 1 | 2;
  modifiers?: Modifier[];
}

export interface FillAction extends ActionBase {
  type: "fill";
  target: NodeRef;
  value: string;
  clear?: boolean;
  submit?: boolean;
}

export interface SelectAction extends ActionBase {
  type: "select";
  target: NodeRef | WidgetRef;
  values: string[];
}

export interface SlideAction extends ActionBase {
  type: "slide";
  target: WidgetRef;
  value: number | [number, number];
}

export interface PickDateAction extends ActionBase {
  type: "pick-date";
  target: WidgetRef;
  date: string | { start: string; end: string };
}

export interface UploadAction extends ActionBase {
  type: "upload";
  target: NodeRef | WidgetRef;
  files: string[];
}

export interface ScrollAction extends ActionBase {
  type: "scroll";
  target?: NodeRef;
  to:
    | "top"
    | "bottom"
    | { x: number; y: number }
    | { delta: { x: number; y: number } };
}

export interface WaitAction extends ActionBase {
  type: "wait";
  condition: WaitCondition;
}

export type WaitCondition =
  | { kind: "navigation" }
  | { kind: "node-appears"; locator: Locator }
  | { kind: "node-disappears"; locator: Locator }
  | { kind: "network-idle"; idleMs?: number }
  | { kind: "duration"; ms: number };

export type Modifier = "alt" | "control" | "meta" | "shift";

export interface WidgetRef {
  widgetId: string;
}

export interface ActionResult {
  id?: string;
  success: boolean;
  error?: ActionError;
  /** Preferred: change since the pre-action state. */
  diff?: StateDiff;
  /** Fallback: full snapshot, used when a diff cannot be meaningfully computed. */
  snapshot?: BrowserState;
  durationMs: number;
}

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  retryable: boolean;
  data?: Record<string, unknown>;
}

export type ActionErrorCode =
  | "target-not-found"
  | "target-not-interactable"
  | "target-disabled"
  | "target-hidden"
  | "target-obscured"
  | "widget-type-mismatch"
  | "invalid-value"
  | "timeout"
  | "navigation-failed"
  | "transport-error"
  | "unknown";
