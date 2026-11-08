import { setHidden } from "../../ui/dom.ts";
import type { CellHost, CellRef } from "./cellView.ts";
import { ColumnHeaderView } from "./columnHeaderView.ts";
import { cellId, changedCells, hasCell, type EditorSpec, type EditorState } from "./model.ts";
import { RowView } from "./rowView.ts";
import { barFractions, isNarrowed, visibleKeys, type ViewPrefs } from "./rows.ts";
import { fieldsOfSection, type Table } from "./schema.ts";
import { SectionView } from "./sectionView.ts";

const COLUMN_MIN_PX = 112;
const STAT_COLUMN_PX = 232;
const FLASH_MS = 900;

export interface MatrixHost extends Omit<CellHost, "move"> {
  toggleSection(id: string): void;
  revertColumn(column: string): void;
  /** The pointer is over this field (and column, over a cell), or left the table (null). */
  hover(target: { column: string | null; field: string } | null): void;
}

export interface MatrixModel {
  state: EditorState;
  prefs: ViewPrefs;
  /** Problems by cell id: the editor's own, then the dev server's. */
  errors: Readonly<Record<string, string>>;
}

/** The table: columns across, fields down, grouped in sections. Built once from the table's columns, then updated in place. */
export class MatrixView {
  readonly table = document.createElement("table");
  private readonly headers = new Map<string, ColumnHeaderView>();
  private readonly sections = new Map<string, SectionView>();
  private readonly rows = new Map<string, RowView>();

  /** `shape` gives the columns and which fields each has. It is read once. */
  constructor(
    private readonly spec: EditorSpec,
    shape: Table,
    private readonly columnLabel: (column: string) => string,
    private readonly host: MatrixHost,
  ) {
    const columns = Object.keys(shape);
    const cellHost: CellHost = { ...host, move: (c, rows) => this.move(c, rows) };
    this.table.className = "matrix";
    this.table.style.minWidth = `${STAT_COLUMN_PX + columns.length * COLUMN_MIN_PX}px`;
    this.table.append(this.buildHead(columns), this.buildBody(shape, columns, cellHost));
    this.wireHover();
  }

  /** Where a page puts art in the column's header. */
  headerSlot(column: string): HTMLElement {
    return this.headers.get(column)!.slot;
  }

  update(m: MatrixModel): void {
    const changes = changedCells(m.state);
    const changedFields = new Set(changes.map((c) => c.field));
    const visible = visibleKeys(this.spec.schema, m.prefs, changedFields);
    this.updateHeaders(changes.map((c) => c.column));
    this.updateSections(m, visible, changes.map((c) => c.field));
    for (const field of visible) this.updateRow(m, field);
    for (const [field, row] of this.rows) setHidden(row.tr, !visible.has(field));
  }

  /** Scrolls to the cell, focuses it and flashes it. The row must be visible. */
  reveal(c: CellRef): void {
    const cell = this.rows.get(c.field)?.cells.get(c.column);
    if (!cell) return;
    cell.control.focus({ preventScroll: true });
    cell.td.scrollIntoView({ block: "center", inline: "center" });
    cell.td.animate([{ backgroundColor: "rgba(255, 210, 87, 0.7)" }, { backgroundColor: "transparent" }], FLASH_MS);
  }

  private buildHead(columns: readonly string[]): HTMLElement {
    const head = document.createElement("thead");
    const tr = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "corner";
    tr.append(corner);
    for (const column of columns) {
      const header = new ColumnHeaderView(column, this.columnLabel(column), () => this.host.revertColumn(column));
      this.headers.set(column, header);
      tr.append(header.th);
    }
    head.append(tr);
    return head;
  }

  private buildBody(shape: Table, columns: readonly string[], cellHost: CellHost): HTMLElement {
    const body = document.createElement("tbody");
    for (const section of this.spec.schema.sections) {
      const view = new SectionView(section, () => this.host.toggleSection(section.id), columns.length);
      this.sections.set(section.id, view);
      body.append(view.tr);
      for (const field of fieldsOfSection(this.spec.schema, section.id)) {
        const row = new RowView(field, columns, cellHost, (column) => hasCell(shape, column, field.key), this.columnLabel);
        this.rows.set(field.key, row);
        body.append(row.tr);
      }
    }
    return body;
  }

  private updateHeaders(changedColumns: readonly string[]): void {
    const set = new Set(changedColumns);
    for (const [column, header] of this.headers) header.update(set.has(column));
  }

  private updateSections(m: MatrixModel, visible: ReadonlySet<string>, changedFields: readonly string[]): void {
    const narrowed = isNarrowed(m.prefs);
    const { schema } = this.spec;
    const columns = Object.keys(m.state.saved);
    for (const [id, view] of this.sections) {
      const keys = fieldsOfSection(schema, id).map((f) => f.key);
      view.update({
        hidden: !keys.some((k) => visible.has(k)),
        collapsed: !narrowed && m.prefs.collapsed.includes(id),
        changed: changedFields.filter((k) => keys.includes(k)).length,
        invalid: columns.reduce((n, column) => n + keys.filter((k) => cellId(column, k) in m.errors).length, 0),
      });
    }
  }

  private updateRow(m: MatrixModel, field: string): void {
    const { schema, rules } = this.spec;
    const bars = barFractions(schema, m.state.draft, field);
    for (const [column, cell] of this.rows.get(field)!.cells) {
      const id = cellId(column, field);
      const row = m.state.draft[column]!;
      cell.update({
        value: row[field]!,
        saved: m.state.saved[column]![field]!,
        raw: m.state.raw[id],
        error: m.errors[id],
        relevant: rules.relevant(row, field),
        bar: bars[column] ?? 0,
      });
    }
  }

  /** Focus the same column's cell in the next visible row up or down that has one. Stays put at the ends. */
  private move(c: CellRef, rows: number): void {
    const { fields } = this.spec.schema;
    const step = rows < 0 ? -1 : 1;
    for (let i = fields.findIndex((f) => f.key === c.field) + step; i >= 0 && i < fields.length; i += step) {
      const row = this.rows.get(fields[i]!.key);
      const cell = row?.cells.get(c.column);
      if (!row || row.tr.hidden || !cell) continue;
      cell.control.focus();
      return;
    }
  }

  private wireHover(): void {
    this.table.addEventListener("mouseover", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("tr[data-field]");
      const field = el?.dataset.field;
      if (!field) return;
      const column = (e.target as HTMLElement).closest<HTMLElement>("td[data-column]")?.dataset.column;
      this.host.hover({ column: column ?? null, field });
    });
    this.table.addEventListener("mouseleave", () => this.host.hover(null));
  }
}
