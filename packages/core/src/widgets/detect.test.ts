import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../session.js";

let session: Session;

beforeAll(async () => {
  session = await Session.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await session?.close();
});

describe("Widget detection", () => {
  it("detects a native range input as a slider widget with min/max/value", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Slider</title></head>
  <body>
    <input type="range" min="0" max="100" value="42" aria-label="Volume" />
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    expect(state.widgets, "widgets present").toHaveLength(1);
    const w = state.widgets[0]!;
    expect(w.type).toBe("slider");
    expect(w.state).toMatchObject({ min: 0, max: 100, value: 42 });
    expect(w.hints).toMatchObject({
      fillStrategies: ["aria-valuenow", "keyboard", "drag"],
    });

    const sliderNode = state.nodes.find((n) => n.id === w.nodeIds[0]);
    expect(sliderNode?.role).toBe("slider");
    expect(sliderNode?.name).toBe("Volume");
  });

  it("detects a custom ARIA slider", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Custom Slider</title></head>
  <body>
    <div role="slider"
         aria-valuemin="10"
         aria-valuemax="20"
         aria-valuenow="15"
         aria-label="Rating"
         tabindex="0"
         style="width:200px;height:24px;background:#ccc">
    </div>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    expect(state.widgets).toHaveLength(1);
    expect(state.widgets[0]!.state).toMatchObject({ min: 10, max: 20, value: 15 });
  });

  it("does not produce widgets for pages without any", async () => {
    const html = `<!doctype html><html><head><title>Plain</title></head><body><button>Go</button></body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    expect(state.widgets).toEqual([]);
  });

  it("detects a native <select> as a combobox widget", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Select</title></head>
  <body>
    <select aria-label="Country">
      <option>USA</option>
      <option>Canada</option>
    </select>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const combos = state.widgets.filter((w) => w.type === "combobox");
    expect(combos, "at least one combobox detected").not.toHaveLength(0);
    const w = combos[0]!;
    expect(w.state).toMatchObject({ multi: false, open: false });
    expect(w.hints).toMatchObject({ searchable: true });
  });

  it("detects an ARIA listbox with multiselectable", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Listbox</title></head>
  <body>
    <ul role="listbox" aria-label="Colors" aria-multiselectable="true" tabindex="0">
      <li role="option">Red</li>
      <li role="option" aria-selected="true">Green</li>
      <li role="option">Blue</li>
    </ul>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const listbox = state.widgets.find((w) => w.type === "listbox");
    expect(listbox, "listbox widget detected").toBeDefined();
    expect(listbox!.state).toMatchObject({ multi: true });
    expect(listbox!.hints).toMatchObject({ searchable: false });
  });

  it("detects a radiogroup with options and current value", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Radio</title></head>
  <body>
    <div role="radiogroup" aria-label="Payment">
      <div role="radio" aria-checked="false" aria-label="Visa" tabindex="0">Visa</div>
      <div role="radio" aria-checked="true" aria-label="Mastercard" tabindex="0">Mastercard</div>
      <div role="radio" aria-checked="false" aria-label="PayPal" tabindex="0">PayPal</div>
    </div>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const rg = state.widgets.find((w) => w.type === "radiogroup");
    expect(rg, "radiogroup detected").toBeDefined();
    const s = rg!.state as { value: string | null; options: { label: string }[] };
    expect(s.value).toBe("Mastercard");
    expect(s.options.map((o) => o.label)).toEqual(["Visa", "Mastercard", "PayPal"]);
  });

  it("detects a checkboxgroup when a group contains only checkboxes", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Checkboxes</title></head>
  <body>
    <div role="group" aria-label="Toppings">
      <div role="checkbox" aria-checked="true" aria-label="Cheese" tabindex="0">Cheese</div>
      <div role="checkbox" aria-checked="false" aria-label="Olives" tabindex="0">Olives</div>
      <div role="checkbox" aria-checked="true" aria-label="Mushrooms" tabindex="0">Mushrooms</div>
    </div>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const cg = state.widgets.find((w) => w.type === "checkboxgroup");
    expect(cg, "checkboxgroup detected").toBeDefined();
    const s = cg!.state as { values: string[]; options: { label: string }[] };
    expect(s.values).toEqual(["Cheese", "Mushrooms"]);
    expect(s.options).toHaveLength(3);
  });

  it("does NOT detect a checkboxgroup when the group contains other controls", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Mixed group</title></head>
  <body>
    <div role="group" aria-label="Form">
      <div role="checkbox" aria-checked="false" aria-label="Agree" tabindex="0">Agree</div>
      <div role="checkbox" aria-checked="false" aria-label="Subscribe" tabindex="0">Subscribe</div>
      <button>Submit</button>
    </div>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();
    expect(state.widgets.find((w) => w.type === "checkboxgroup")).toBeUndefined();
  });

  it("detects a toggleswitch with checked state", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Switch</title></head>
  <body>
    <button role="switch" aria-checked="true" aria-label="Notifications">On</button>
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const sw = state.widgets.find((w) => w.type === "toggleswitch");
    expect(sw, "toggleswitch detected").toBeDefined();
    expect((sw!.state as { checked: boolean }).checked).toBe(true);
  });

  it("detects a tablist with tabs and a selected one", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="tablist" aria-label="Sections">
    <button role="tab" aria-selected="false" tabindex="0">Overview</button>
    <button role="tab" aria-selected="true" tabindex="0">Pricing</button>
    <button role="tab" aria-selected="false" tabindex="0">FAQ</button>
  </div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const tabs = state.widgets.find((w) => w.type === "tabs");
    expect(tabs, "tabs widget detected").toBeDefined();
    const s = tabs!.state as { selected: string; items: { label: string }[] };
    expect(s.selected).toBe("Pricing");
    expect(s.items.map((i) => i.label)).toEqual(["Overview", "Pricing", "FAQ"]);
  });

  it("detects an open role=menu with menuitems", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="menu" aria-label="File">
    <div role="menuitem" tabindex="-1">New</div>
    <div role="menuitem" tabindex="-1">Open</div>
    <div role="menuitem" aria-disabled="true" tabindex="-1">Save</div>
  </div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const menu = state.widgets.find((w) => w.type === "menu");
    expect(menu, "menu widget detected").toBeDefined();
    const s = menu!.state as { open: boolean; items: { label: string; disabled?: boolean }[] };
    expect(s.open).toBe(true);
    expect(s.items.map((i) => i.label)).toEqual(["New", "Open", "Save"]);
  });

  it("detects an accordion from sibling expandable buttons", async () => {
    const html = `<!doctype html>
<html><body>
  <div>
    <h3><button aria-expanded="true" aria-controls="p1">Section A</button></h3>
    <div id="p1" role="region">Content A</div>
    <h3><button aria-expanded="false" aria-controls="p2">Section B</button></h3>
    <div id="p2" role="region" hidden>Content B</div>
    <h3><button aria-expanded="false" aria-controls="p3">Section C</button></h3>
    <div id="p3" role="region" hidden>Content C</div>
  </div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const acc = state.widgets.find((w) => w.type === "accordion");
    expect(acc, "accordion widget detected").toBeDefined();
    const s = acc!.state as { expanded: string[]; items: { label: string }[] };
    expect(s.expanded).toEqual(["Section A"]);
    expect(s.items.map((i) => i.label)).toEqual(["Section A", "Section B", "Section C"]);
  });

  it("detects a role=tooltip widget with its text", async () => {
    const html = `<!doctype html>
<html><body>
  <button aria-describedby="t1">Info</button>
  <div role="tooltip" id="t1">This is helpful</div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const tip = state.widgets.find((w) => w.type === "tooltip");
    expect(tip, "tooltip widget detected").toBeDefined();
    const s = tip!.state as { visible: boolean; text?: string };
    expect(s.visible).toBe(true);
    expect(s.text).toBe("This is helpful");
  });

  it("detects a native date input as a datepicker widget", async () => {
    const html = `<!doctype html>
<html><body>
  <input type="date" aria-label="Birthday" value="2026-04-17" min="2000-01-01" max="2030-12-31" />
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const dp = state.widgets.find((w) => w.type === "datepicker");
    expect(dp, "datepicker detected").toBeDefined();
    const s = dp!.state as { value: string | null; min?: string; max?: string; open: boolean };
    expect(s.value).toBe("2026-04-17");
    expect(s.min).toBe("2000-01-01");
    expect(s.max).toBe("2030-12-31");
    expect(s.open).toBe(false);
  });

  it("detects a daterange group with two date inputs as a daterange-picker", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="group" aria-label="Booking range">
    <input type="date" aria-label="Check-in" value="2026-05-01" />
    <input type="date" aria-label="Check-out" value="2026-05-05" />
  </div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const drp = state.widgets.find((w) => w.type === "daterange-picker");
    expect(drp, "daterange-picker detected").toBeDefined();
    const s = drp!.state as { start: string | null; end: string | null };
    expect(s.start).toBe("2026-05-01");
    expect(s.end).toBe("2026-05-05");

    // Children must NOT also appear as separate datepickers.
    const dps = state.widgets.filter((w) => w.type === "datepicker");
    expect(dps).toHaveLength(0);
  });

  it("detects a native number input as a stepper widget", async () => {
    const html = `<!doctype html>
<html><body>
  <input type="number" aria-label="Guests" value="2" min="1" max="10" />
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const stepper = state.widgets.find((w) => w.type === "stepper");
    expect(stepper, "stepper detected").toBeDefined();
    const s = stepper!.state as { value: number; min?: number; max?: number };
    expect(s.value).toBe(2);
    expect(s.min).toBe(1);
    expect(s.max).toBe(10);

    const anchor = state.nodes.find((n) => n.id === stepper!.nodeIds[0]);
    expect(anchor?.role).toBe("spinbutton");
    expect(anchor?.name).toBe("Guests");
  });

  it("detects a custom ARIA spinbutton as a stepper", async () => {
    const html = `<!doctype html>
<html><body>
  <div role="spinbutton"
       aria-label="Quantity"
       aria-valuenow="5"
       aria-valuemin="0"
       aria-valuemax="99"
       tabindex="0">5</div>
</body></html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const stepper = state.widgets.find((w) => w.type === "stepper");
    expect(stepper, "stepper detected").toBeDefined();
    expect(stepper!.state).toMatchObject({ value: 5, min: 0, max: 99 });
  });

  it("detects a file input as a fileupload widget with accept + multiple", async () => {
    const html = `<!doctype html>
<html>
  <head><title>Upload</title></head>
  <body>
    <input type="file" aria-label="Avatar" accept="image/png, image/jpeg" multiple />
  </body>
</html>`;
    await session.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const state = await session.snapshot();

    const fu = state.widgets.find((w) => w.type === "fileupload");
    expect(fu, "fileupload detected").toBeDefined();
    const s = fu!.state as { current: string[]; multiple: boolean; accept?: string[] };
    expect(s.multiple).toBe(true);
    expect(s.current).toEqual([]);
    expect(s.accept).toEqual(["image/png", "image/jpeg"]);
    expect((fu!.hints as { strategy: string }).strategy).toBe("input-change");
  });
});
