import type { Node, NodeRef, Overlay, Viewport, Widget } from "./browser-state.js";

export interface StateDiff {
  version: string;
  /** Capture timestamp of the before-state. */
  from: string;
  /** Capture timestamp of the after-state. */
  to: string;
  changes: Change[];
}

export type Change =
  | NodeAddedChange
  | NodeRemovedChange
  | NodeModifiedChange
  | WidgetAddedChange
  | WidgetRemovedChange
  | WidgetModifiedChange
  | FocusChangedChange
  | UrlChangedChange
  | TitleChangedChange
  | OverlayAppearedChange
  | OverlayDismissedChange
  | ViewportChangedChange;

export interface NodeAddedChange {
  kind: "node-added";
  node: Node;
}

export interface NodeRemovedChange {
  kind: "node-removed";
  nodeId: string;
  frameId: string;
}

export interface NodeModifiedChange {
  kind: "node-modified";
  nodeId: string;
  frameId: string;
  /** Only the fields that changed. Dot-paths for nested fields (e.g. "state.disabled"). */
  fields: Record<string, unknown>;
}

export interface WidgetAddedChange {
  kind: "widget-added";
  widget: Widget;
}

export interface WidgetRemovedChange {
  kind: "widget-removed";
  widgetId: string;
}

export interface WidgetModifiedChange {
  kind: "widget-modified";
  widgetId: string;
  fields: Record<string, unknown>;
}

export interface FocusChangedChange {
  kind: "focus-changed";
  from?: NodeRef;
  to?: NodeRef;
}

export interface UrlChangedChange {
  kind: "url-changed";
  from: string;
  to: string;
}

export interface TitleChangedChange {
  kind: "title-changed";
  from: string;
  to: string;
}

export interface OverlayAppearedChange {
  kind: "overlay-appeared";
  overlay: Overlay;
}

export interface OverlayDismissedChange {
  kind: "overlay-dismissed";
  nodeId: string;
}

export interface ViewportChangedChange {
  kind: "viewport-changed";
  fields: Partial<Viewport>;
}
