import type { CellRef } from "./cellView.ts";
import { createFeed } from "./feed.ts";
import { FooterView } from "./footerView.ts";
import { installKeys } from "./keys.ts";
import { MatrixView } from "./matrixView.ts";
import {
  applySaved, cellId, changedCells, errorsOf, hasCell, merged, redo, remoteCells, restoreDraft, revertAll, revertCell, revertColumn,
  seal, setValue, stepValue, typeText, undo, withServerErrors, type DraftCell, type EditorState,
} from "./model.ts";
import { revealPrefs, toggleSection, type ViewPrefs } from "./rows.ts";
import type { Rules, Schema, Table } from "./schema.ts";
import { StatusView, type Tone } from "./statusView.ts";
import type { LocalStore, Remote } from "./store.ts";
import { ToolbarView } from "./toolbarView.ts";

export interface EditorElements {
  toolbar: HTMLElement;
  status: HTMLElement;
  scroll: HTMLElement;
  footer: HTMLElement;
}

export interface Labels {
  /** The toolbar's title. */
  title: string;
  filterPlaceholder: string;
  savedMessage: string;
  /** A column's name, for headers, the status list and the info strip. */
  columnLabel(id: string): string;
}

/** Everything that makes one table editor page: what it edits, its rules, where it loads and saves, how it speaks. */
export interface PageAdapter {
  schema: Schema;
  rules: Rules;
  remote: Remote;
  store: LocalStore;
  labels: Labels;
}

/** The editor: owns the state, applies each user action to it, and redraws the views from it. */
export class TableEditor {
  private current: EditorState;
  private prefs: ViewPrefs;
  private message = "";
  private tone: Tone = "info";
  private saving = false;
  private focus: CellRef | null = null;
  private hover: { column: string | null; field: string } | null = null;
  private errors: Record<string, string> = {};
  private readonly drafts = createFeed<Table>();
  private readonly matrix: MatrixView;
  private readonly toolbar: ToolbarView;
  private readonly status: StatusView;
  private readonly footer: FooterView;

  constructor(private readonly adapter: PageAdapter, saved: Table, draft: readonly DraftCell[], els: EditorElements) {
    const { schema, rules, store, labels } = adapter;
    this.prefs = store.loadPrefs();
    this.current = restoreDraft({ schema, rules }, saved, draft);
    this.matrix = new MatrixView({ schema, rules }, saved, labels.columnLabel, {
      type: (c, text) => this.apply((s) => typeText(s, c.column, c.field, text)),
      set: (c, value) => this.apply((s) => setValue(s, c.column, c.field, value)),
      step: (c, delta) => this.apply((s) => stepValue(s, c.column, c.field, delta)),
      revert: (c) => this.apply((s) => revertCell(s, c.column, c.field)),
      focus: (c) => this.onFocus(c),
      toggleSection: (id) => this.setPrefs(toggleSection(this.prefs, id)),
      revertColumn: (column) => this.apply((s) => revertColumn(s, column)),
      hover: (t) => { this.hover = t; this.drawFooter(); },
    });
    els.scroll.append(this.matrix.table);
    this.toolbar = new ToolbarView(els.toolbar, {
      onFilter: (filter) => this.setPrefs({ ...this.prefs, filter }),
      onChangedOnly: (changedOnly) => this.setPrefs({ ...this.prefs, changedOnly }),
      onUndo: () => this.apply(undo),
      onRedo: () => this.apply(redo),
      onRevertAll: () => this.apply(revertAll),
      onSave: () => void this.save(),
    }, labels.title, labels.filterPlaceholder);
    this.status = new StatusView(els.status, schema, labels.columnLabel, (column, field) => this.jump({ column, field }));
    this.footer = new FooterView(els.footer, schema, labels.columnLabel);
    installKeys({
      save: () => void this.save(),
      undo: () => this.apply(undo),
      redo: () => this.apply(redo),
      focusFilter: () => this.toolbar.focusFilter(),
      clearFilter: () => this.clearFilter(),
    });
    window.addEventListener("beforeunload", (e) => this.warnOnLeave(e));
    this.draw();
  }

  /** The draft table, for a page's own buttons. */
  draft(): Table {
    return this.current.draft;
  }

  /** Calls `listener` with the new draft on every edit, undo, redo, revert and save, before the views redraw. Not for the draft the editor starts with. */
  onChange(listener: (draft: Table) => void): void {
    this.drafts.subscribe(listener);
  }

  /** The whole state, for a page's own buttons. */
  state(): EditorState {
    return this.current;
  }

  /** Where a page puts art in a column's header, such as a headshot that arrives after the first draw. */
  headerSlot(column: string): HTMLElement {
    return this.matrix.headerSlot(column);
  }

  private apply(change: (s: EditorState) => EditorState): void {
    const next = change(this.current);
    if (next === this.current) return;
    const edited = next.draft !== this.current.draft;
    if (edited) this.message = "";
    this.current = next;
    if (edited) {
      this.adapter.store.saveDraft(changedCells(next));
      this.drafts.emit(next.draft);
    }
    this.draw();
  }

  private setPrefs(prefs: ViewPrefs): void {
    this.prefs = prefs;
    this.adapter.store.savePrefs(prefs);
    this.draw();
  }

  private clearFilter(): boolean {
    if (this.prefs.filter === "") return false;
    this.setPrefs({ ...this.prefs, filter: "" });
    return true;
  }

  private onFocus(c: CellRef | null): void {
    this.focus = c;
    if (c === null) this.apply(seal);
    this.drawFooter();
  }

  /** Opens the cell's row, focuses the cell and flashes it. */
  private jump(c: CellRef): void {
    this.setPrefs(revealPrefs(this.adapter.schema, this.prefs, c.field, new Set(changedCells(this.current).map((x) => x.field))));
    this.matrix.reveal(c);
  }

  private async save(): Promise<void> {
    if (this.saving || !this.canSave()) return;
    this.saving = true;
    this.say("Saving...", "info");
    this.current = withServerErrors(this.current, []);
    const result = await this.adapter.remote.save(merged(this.current));
    this.saving = false;
    if (result.ok) {
      this.current = applySaved(this.current, result.table);
      this.adapter.store.saveDraft([]);
      this.drafts.emit(this.current.draft);
      this.say(this.adapter.labels.savedMessage, "ok");
    } else if (result.reason === "invalid") {
      this.current = withServerErrors(this.current, result.errors);
      this.say("The dev server refused the save.", "error");
    } else {
      this.say(`${result.message} Your changes are kept.`, "error");
    }
  }

  private say(message: string, tone: Tone): void {
    this.message = message;
    this.tone = tone;
    this.draw();
  }

  private canSave(): boolean {
    return changedCells(this.current).length > 0 && Object.keys(errorsOf(this.current)).length === 0;
  }

  private warnOnLeave(e: BeforeUnloadEvent): void {
    if (this.saving || changedCells(this.current).length === 0) return;
    e.preventDefault();
    e.returnValue = "";
  }

  private draw(): void {
    const local = errorsOf(this.current);
    this.errors = { ...remoteCells(this.current), ...local };
    const changes = changedCells(this.current).length;
    const unparsed = Object.keys(this.current.raw).length;
    this.matrix.update({ state: this.current, prefs: this.prefs, errors: this.errors });
    this.toolbar.update({
      filter: this.prefs.filter,
      changedOnly: this.prefs.changedOnly,
      changes,
      canUndo: this.current.undo.length > 0,
      canRedo: this.current.redo.length > 0,
      canRevert: changes > 0 || unparsed > 0,
      canSave: changes > 0 && Object.keys(local).length === 0,
      saving: this.saving,
      saveHint: changes === 0 ? "Nothing to save" : "Fix the red cells first",
    });
    this.status.update({ message: this.message, tone: this.tone, errors: this.current.remote });
    this.drawFooter();
  }

  private drawFooter(): void {
    const t = this.focus ?? this.hover;
    if (!t) return this.footer.update(null);
    const { column, field } = t;
    const known = column !== null && hasCell(this.current.saved, column, field);
    this.footer.update({
      field,
      column,
      saved: known ? this.current.saved[column]![field]! : null,
      error: column ? this.errors[cellId(column, field)] : undefined,
    });
  }
}
