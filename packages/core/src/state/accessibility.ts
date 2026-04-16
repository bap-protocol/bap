import type { Locator, Node, NodeState } from "@bap-protocol/spec";

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

export function axNodesToNodes(axNodes: CDPAXNode[], frameId: string): Node[] {
  const byId = new Map(axNodes.map((n) => [n.nodeId, n]));
  const parentOf = new Map<string, string>();
  for (const n of axNodes) {
    for (const childId of n.childIds ?? []) {
      parentOf.set(childId, n.nodeId);
    }
  }

  const nodes: Node[] = [];
  for (const ax of axNodes) {
    if (ax.ignored) continue;
    const role = asString(ax.role);
    if (!role) continue;

    const name = asString(ax.name);
    const description = asString(ax.description);
    const value = ax.value?.value;

    const node: Node = {
      id: ax.nodeId,
      role,
      childIds: (ax.childIds ?? []).filter((cid) => {
        const c = byId.get(cid);
        return c !== undefined && !c.ignored;
      }),
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
    if (parentId) node.parentId = parentId;

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
        if (v === true) state.disabled = true;
        break;
      case "checked":
        if (v === true || v === false || v === "mixed") state.checked = v;
        break;
      case "expanded":
        if (typeof v === "boolean") state.expanded = v;
        break;
      case "selected":
        if (typeof v === "boolean") state.selected = v;
        break;
      case "required":
        if (v === true) state.required = true;
        break;
      case "readonly":
        if (v === true) state.readonly = true;
        break;
      case "focused":
        if (v === true) state.focused = true;
        break;
      case "invalid":
        if (v === true || (typeof v === "string" && v !== "false")) state.invalid = true;
        break;
      case "hidden":
        if (v === true) state.hidden = true;
        break;
    }
  }
  return state;
}

function computeLocator(role: string, name: string | undefined): Locator {
  if (name) {
    return { strategy: "role-name", value: `${role}:${name}` };
  }
  return { strategy: "role-name", value: role };
}
