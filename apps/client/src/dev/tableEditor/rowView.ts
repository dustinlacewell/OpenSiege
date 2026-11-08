import { CellView, type CellHost } from "./cellView.ts";
import type { FieldSpec } from "./schema.ts";

/** One field's row: its label with unit and help, then a cell per column. A column without the field gets a blank cell. */
export class RowView {
  readonly tr = document.createElement("tr");
  /** The editable cells by column id. A blank cell has no entry. */
  readonly cells = new Map<string, CellView>();

  constructor(
    readonly spec: FieldSpec,
    columns: readonly string[],
    host: CellHost,
    has: (column: string) => boolean,
    columnLabel: (column: string) => string,
  ) {
    const head = document.createElement("th");
    head.scope = "row";
    head.className = "stat";
    head.title = spec.help;
    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = spec.label;
    const unit = document.createElement("span");
    unit.className = "stat-unit";
    unit.textContent = spec.unit;
    head.append(label, unit);
    this.tr.dataset.field = spec.key;
    this.tr.append(head);
    for (const column of columns) {
      if (!has(column)) {
        this.tr.append(blankCell(column));
        continue;
      }
      const cell = new CellView({ column, field: spec.key }, spec, `${columnLabel(column)} ${spec.label}`, host);
      this.cells.set(column, cell);
      this.tr.append(cell.td);
    }
  }
}

function blankCell(column: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.className = "cell blank";
  td.dataset.column = column;
  return td;
}
