import { SETTINGS_TABS, type SettingsField, type SettingsTab, type SettingsValues } from "../settings/settingsModel.ts";
import type { SettingsStore } from "../settings/settingsStore.ts";
import { byId, setHidden, setText } from "./dom.ts";

/** The tabbed settings modal. It draws `SETTINGS_TABS` and reads and writes the store. */
export class SettingsModal {
  private readonly overlay = byId("settings");
  private readonly tabs = byId("settings-tabs");
  private readonly fields = byId("settings-fields");
  private tab: SettingsTab = SETTINGS_TABS[0]!;

  constructor(private readonly store: SettingsStore) {
    byId("settings-close").addEventListener("click", () => this.close());
    this.overlay.addEventListener("pointerdown", (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(tab: SettingsTab["id"] = this.tab.id): void {
    this.tab = SETTINGS_TABS.find((t) => t.id === tab) ?? SETTINGS_TABS[0]!;
    this.render();
    setHidden(this.overlay, false);
  }

  close(): void {
    setHidden(this.overlay, true);
  }

  private render(): void {
    this.tabs.replaceChildren(...SETTINGS_TABS.map((t) => this.tabButton(t)));
    this.fields.replaceChildren(...this.tab.fields.map((f) => this.row(f)));
    for (const t of SETTINGS_TABS) if (t.panel) setHidden(byId(t.panel), t !== this.tab);
  }

  private tabButton(t: SettingsTab): HTMLButtonElement {
    const b = button(t.label, t === this.tab);
    b.addEventListener("click", () => this.open(t.id));
    return b;
  }

  private row(f: SettingsField): HTMLElement {
    const row = document.createElement("div");
    row.className = "settings-row";
    const label = document.createElement("span");
    setText(label, f.label);
    row.append(label, this.control(f));
    return row;
  }

  private control(f: SettingsField): HTMLElement {
    const current = this.store.get()[f.id];
    switch (f.kind) {
      case "toggle": return this.segmented([[false, "Off"], [true, "On"]], f, current);
      case "choice": return this.segmented(f.options.map((o) => [o.value, o.label] as const), f, current);
      case "range": return this.slider(f, Number(current));
    }
  }

  /** The store drops a value the field cannot hold. */
  private write(f: SettingsField, value: unknown): void {
    this.store.set({ [f.id]: value } as Partial<SettingsValues>);
  }

  private segmented(options: readonly (readonly [number | string | boolean, string])[], f: SettingsField, current: unknown): HTMLElement {
    const group = document.createElement("div");
    group.className = "segmented";
    for (const [value, text] of options) {
      const b = button(text, value === current);
      b.addEventListener("click", () => {
        this.write(f, value);
        this.render();
      });
      group.append(b);
    }
    return group;
  }

  private slider(f: SettingsField & { kind: "range" }, current: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "settings-range";
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(current);
    const readout = document.createElement("span");
    setText(readout, String(current));
    input.addEventListener("input", () => {
      const v = Number(input.value);
      this.write(f, v);
      setText(readout, String(v));
    });
    wrap.append(input, readout);
    return wrap;
  }
}

function button(text: string, on: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = on ? "on" : "";
  setText(b, text);
  return b;
}
