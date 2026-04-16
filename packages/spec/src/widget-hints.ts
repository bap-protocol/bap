import type { WidgetType } from "./browser-state.js";

/**
 * Per-widget state and hints schemas. These refine the generic `Record<string, unknown>`
 * shape that `Widget.state` and `Widget.hints` carry in `BrowserState`.
 *
 * Consumers that need type safety can narrow a `Widget` by its `type` field and then
 * cast `state` and `hints` to the corresponding interfaces below.
 */

export interface SliderState {
  min: number;
  max: number;
  value: number | [number, number];
  step?: number;
  orientation?: "horizontal" | "vertical";
}

export interface SliderHints {
  fillStrategies: ("aria-valuenow" | "keyboard" | "drag")[];
  thumbNodeIds: string[];
}

export interface DatepickerState {
  value: string | null;
  min?: string;
  max?: string;
  open: boolean;
}

export interface DatepickerHints {
  displayFormat?: string;
  openTrigger: "click-input" | "click-icon" | "focus-input";
  monthNavigation: "arrows" | "dropdowns" | "both";
  locale?: string;
}

export interface DaterangePickerState {
  start: string | null;
  end: string | null;
  min?: string;
  max?: string;
  open: boolean;
}

export interface DaterangePickerHints extends DatepickerHints {
  twoStep: boolean;
}

export interface ComboboxState {
  value: string | string[];
  options?: { value: string; label: string; nodeId?: string }[];
  multi: boolean;
  open: boolean;
}

export interface ComboboxHints {
  searchable: boolean;
  optionsPopulatedOn: "always" | "open" | "type";
  freeText: boolean;
}

export interface MenuState {
  open: boolean;
  items?: { label: string; nodeId: string; disabled?: boolean; submenu?: boolean }[];
}

export interface MenuHints {
  openTrigger: "click" | "hover" | "focus";
}

export interface TabsState {
  selected: string;
  items: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

export interface AccordionState {
  expanded: string[];
  items: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

export interface FileuploadState {
  current: string[];
  multiple: boolean;
  accept?: string[];
}

export interface FileuploadHints {
  strategy: "input-change" | "drop-zone" | "hidden-input";
  dropZoneNodeId?: string;
}

export interface RadiogroupState {
  value: string | null;
  options: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

export interface CheckboxgroupState {
  values: string[];
  options: { value: string; label: string; nodeId: string; disabled?: boolean }[];
}

export interface ToggleswitchState {
  checked: boolean;
}

export interface DialogState {
  open: boolean;
  modal: boolean;
  title?: string;
  actionNodeIds?: string[];
}

export interface TooltipState {
  visible: boolean;
  text?: string;
}

/**
 * Mapping from widget type to its state interface. Use for discriminated narrowing.
 */
export interface WidgetStateMap {
  slider: SliderState;
  datepicker: DatepickerState;
  "daterange-picker": DaterangePickerState;
  combobox: ComboboxState;
  listbox: ComboboxState;
  menu: MenuState;
  tabs: TabsState;
  accordion: AccordionState;
  fileupload: FileuploadState;
  radiogroup: RadiogroupState;
  checkboxgroup: CheckboxgroupState;
  toggleswitch: ToggleswitchState;
  dialog: DialogState;
  tooltip: TooltipState;
}

export interface WidgetHintsMap {
  slider: SliderHints;
  datepicker: DatepickerHints;
  "daterange-picker": DaterangePickerHints;
  combobox: ComboboxHints;
  listbox: ComboboxHints;
  menu: MenuHints;
  tabs: Record<string, never>;
  accordion: Record<string, never>;
  fileupload: FileuploadHints;
  radiogroup: Record<string, never>;
  checkboxgroup: Record<string, never>;
  toggleswitch: Record<string, never>;
  dialog: Record<string, never>;
  tooltip: Record<string, never>;
}

export type StateOf<T extends WidgetType> = WidgetStateMap[T];
export type HintsOf<T extends WidgetType> = WidgetHintsMap[T];
