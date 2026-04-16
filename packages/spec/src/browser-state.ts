export interface BrowserState {
  version: string;
  capturedAt: string;
  url: string;
  title: string;
  viewport: Viewport;
  frames: Frame[];
  nodes: Node[];
  widgets: Widget[];
  focus?: NodeRef;
  overlays: Overlay[];
  metadata: Metadata;
}

export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

export interface Frame {
  id: string;
  url: string;
  parentFrameId?: string;
}

export interface Node {
  id: string;
  role: string;
  name?: string;
  description?: string;
  value?: string;
  interactable: boolean;
  editable: boolean;
  state: NodeState;
  rect?: Rect;
  parentId?: string;
  childIds: string[];
  frameId: string;
  locator: Locator;
}

export interface NodeState {
  disabled?: boolean;
  checked?: boolean | "mixed";
  expanded?: boolean;
  selected?: boolean;
  required?: boolean;
  invalid?: boolean;
  readonly?: boolean;
  focused?: boolean;
  hidden?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  inViewport: boolean;
}

export type LocatorStrategy = "id" | "testid" | "role-name" | "xpath" | "css";

export interface Locator {
  strategy: LocatorStrategy;
  value: string;
}

export type WidgetType =
  | "slider"
  | "datepicker"
  | "daterange-picker"
  | "combobox"
  | "listbox"
  | "menu"
  | "tabs"
  | "accordion"
  | "fileupload"
  | "radiogroup"
  | "checkboxgroup"
  | "toggleswitch"
  | "dialog"
  | "tooltip";

export interface Widget {
  id: string;
  type: WidgetType;
  nodeIds: string[];
  state: Record<string, unknown>;
  hints: Record<string, unknown>;
}

export type OverlayType = "modal" | "toast" | "tooltip" | "menu";

export interface Overlay {
  nodeId: string;
  type: OverlayType;
  blocking: boolean;
}

export interface NodeRef {
  nodeId: string;
  frameId: string;
}

export interface Metadata {
  userAgent: string;
  timezone: string;
  language: string;
}
