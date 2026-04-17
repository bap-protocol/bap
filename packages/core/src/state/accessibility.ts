import type { Locator, Node, NodeState, Rect } from "@bap-protocol/spec";

interface CDPAXValue {
  type: string;
  value?: unknown;
}

interface CDPAXProperty {
  name: string;
  value: CDPAXValue;
}

export interface CDPAXNode {
  nodeId: string;
  ignored: boolean;
  role?: CDPAXValue;
  name?: CDPAXValue;
  description?: CDPAXValue;
  value?: CDPAXValue;
  properties?: CDPAXProperty[];
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
  frameId?: string;
}

const INTERACTABLE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "spinbutton",
]);

const EDITABLE_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton"]);

export function axNodesToNodes(
  axNodes: CDPAXNode[],
  frameId: string,
  rectByBackendId?: Map<number, Rect>,
): Node[] {
  const byId = new Map(axNodes.map((n) => [n.nodeId, n]));
  const parentOf = new Map<string, string>();
  for (const n of axNodes) {
    for (const childId of n.childIds ?? []) {
      parentOf.set(childId, n.nodeId);
    }
  }

  const prefix = (axId: string) => `${frameId}:${axId}`;

  const nodes: Node[] = [];
  for (const ax of axNodes) {
    if (ax.ignored) continue;
    const role = asString(ax.role);
    if (!role) continue;

    const name = asString(ax.name);
    const description = asString(ax.description);
    const value = ax.value?.value;

    const node: Node = {
      id: prefix(ax.nodeId),
      role,
      childIds: (ax.childIds ?? [])
        .filter((cid) => {
          const c = byId.get(cid);
          return c !== undefined && !c.ignored;
        })
        .map(prefix),
      frameId,
      interactable: INTERACTABLE_ROLES.has(role),
      editable: EDITABLE_ROLES.has(role),
      state: extractState(ax.properties ?? []),
      locator: computeLocator(role, name),
    };
    if (name) node.name = name;
    if (description) node.description = description;
    if (value !== undefined && value !== null) node.value = String(value);

    const parentId = parentOf.get(ax.nodeId);
    if (parentId) node.parentId = prefix(parentId);

    if (ax.backendDOMNodeId !== undefined && rectByBackendId) {
      const rect = rectByBackendId.get(ax.backendDOMNodeId);
      if (rect) node.rect = rect;
    }

    nodes.push(node);
  }

  return nodes;
}

function asString(v: CDPAXValue | undefined): string | undefined {
  if (!v) return undefined;
  return typeof v.value === "string" ? v.value : undefined;
}

function extractState(props: CDPAXProperty[]): NodeState {
  const state: NodeState = {};
  for (const p of props) {
    const v = p.value.value;
    switch (p.name) {
      case "disabled":
        if (coerceBool(v) === true) state.disabled = true;
        break;
      case "checked": {
        if (v === "mixed") {
          state.checked = "mixed";
        } else {
          const b = coerceBool(v);
          if (b !== undefined) state.checked = b;
        }
        break;
      }
      case "expanded": {
        const b = coerceBool(v);
        if (b !== undefined) state.expanded = b;
        break;
      }
      case "selected": {
        const b = coerceBool(v);
        if (b !== undefined) state.selected = b;
        break;
      }
      case "required":
        if (coerceBool(v) === true) state.required = true;
        break;
      case "readonly":
        if (coerceBool(v) === true) state.readonly = true;
        break;
      case "focused":
        if (coerceBool(v) === true) state.focused = true;
        break;
      case "invalid":
        if (coerceBool(v) === true || (typeof v === "string" && v !== "false" && v !== "")) {
          state.invalid = true;
        }
        break;
      case "hidden":
        if (coerceBool(v) === true) state.hidden = true;
        break;
    }
  }
  return state;
}

function coerceBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function computeLocator(role: string, name: string | undefined): Locator {
  if (name) {
    return { strategy: "role-name", value: `${role}:${name}` };
  }
  return { strategy: "role-name", value: role };
}
