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
      // Chromium emits ignored `role="none"` wrappers (e.g. plain <div>)
      // in the AX tree. Skipping them naively would break the parent/child
      // chain; we instead descend through ignored nodes to collect the
      // first non-ignored descendants, preserving semantic reachability.
      childIds: firstNonIgnoredDescendants(ax.nodeId, byId).map(prefix),
      frameId,
      interactable: INTERACTABLE_ROLES.has(role),
      editable: EDITABLE_ROLES.has(role),
      state: extractState(ax.properties ?? []),
      locator: computeLocator(role, name),
    };
    if (name) node.name = name;
    if (description) node.description = description;
    if (value !== undefined && value !== null) node.value = String(value);

    const parentId = firstNonIgnoredAncestor(ax.nodeId, byId, parentOf);
    if (parentId) node.parentId = prefix(parentId);

    if (ax.backendDOMNodeId !== undefined && rectByBackendId) {
      const rect = rectByBackendId.get(ax.backendDOMNodeId);
      if (rect) node.rect = rect;
    }

    nodes.push(node);
  }

  return nodes;
}

function firstNonIgnoredAncestor(
  axId: string,
  byId: Map<string, CDPAXNode>,
  parentOf: Map<string, string>,
): string | undefined {
  let current = parentOf.get(axId);
  while (current !== undefined) {
    const n = byId.get(current);
    if (n && !n.ignored) return current;
    const next = parentOf.get(current);
    if (next === undefined) return undefined;
    current = next;
  }
  return undefined;
}

function firstNonIgnoredDescendants(
  axId: string,
  byId: Map<string, CDPAXNode>,
): string[] {
  const result: string[] = [];
  const walk = (id: string) => {
    const n = byId.get(id);
    if (!n) return;
    if (!n.ignored) {
      result.push(id);
      return; // stop at first non-ignored, deeper descendants attach to it
    }
    for (const cid of n.childIds ?? []) walk(cid);
  };
  const root = byId.get(axId);
  for (const cid of root?.childIds ?? []) walk(cid);
  return result;
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
