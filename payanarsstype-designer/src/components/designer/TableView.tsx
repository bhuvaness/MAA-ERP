import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { PTSInterpreter, TypeRegistry } from "../../services/pts-interpreter";
import type { CellResult, ColumnInfo, PTSNode } from "../../services/pts-interpreter";
import "./TableView.css";

/** One data row: values of the INPUT columns, keyed by column name. Formula columns are computed. */
export type Row = Record<string, string>;

export interface TableViewProps {
  /** The PTS node list (flat, Id/ParentId). Falls back to `types`. */
  nodes?: PTSNode[];
  /** Id of the scope node to show as a table. Falls back to `parentType.Id`. */
  scopeId?: string;

  // ---- props used by PayanarssTypeDesigner today (accepted so the designer needs no change)
  /** All PayanarssTypes, same flat list as `nodes`. */
  types?: PTSNode[];
  /** The type currently open in the designer; its Id is the scope. */
  parentType?: { Id: string };
  /** Accepted for compatibility; columns are derived from the scope's children. */
  columns?: unknown;
  /** Accepted for compatibility; unused. */
  getTypeName?: unknown;

  /** Type registry; defaults to TypeRegistry.default(). */
  registry?: TypeRegistry;
  initialRows?: Row[];
  /** Called with the filled rows whenever they change. */
  onRowsChange?: (rows: Row[]) => void;
  onClose?: () => void;
  /** Digits kept for non-integer results (display only). Default 4. */
  decimals?: number;
  /** Wrap in a full-screen overlay (as in the designer). Default true. */
  modal?: boolean;
}

// ---------------------------------------------------------------- helpers

const isBlank = (row: Row) => Object.values(row).every((v) => v.trim() === "");

/** Keep one empty "entry" row at the bottom, like a spreadsheet. */
const withTrailingBlank = (rows: Row[]): Row[] =>
  rows.length === 0 || !isBlank(rows[rows.length - 1]) ? [...rows, {}] : rows;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const colLetter = (i: number): string => {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

const fmt = (v: number, decimals: number) =>
  Number.isInteger(v) ? String(v) : String(Number(v.toFixed(decimals)));

function display(res: CellResult | undefined, decimals: number): { text: string; error?: string } {
  if (!res) return { text: "" };
  if (res.ok) return { text: fmt(res.value, decimals) };
  switch (res.code) {
    case "MISSING_INPUT":
      return { text: "" }; // incomplete row: stay quiet, like an empty Excel cell
    case "DIV_ZERO":
      return { text: "#DIV/0!", error: res.message };
    case "NOT_A_NUMBER":
      return { text: "#VALUE!", error: res.message };
    default:
      return { text: "#ERROR!", error: res.message };
  }
}

const csvEscape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

type Edit = { r: number; c: number; draft: string };
type Move = "down" | "right" | "left" | "none";

// ---------------------------------------------------------------- component

export function TableView({
  nodes: nodesProp,
  scopeId: scopeIdProp,
  types,
  parentType,
  registry,
  initialRows,
  onRowsChange,
  onClose,
  decimals = 4,
  modal = true,
}: TableViewProps) {
  const nodes = nodesProp ?? types;
  const scopeId = scopeIdProp ?? parentType?.Id ?? "";
  const reg = useMemo(() => registry ?? TypeRegistry.default(), [registry]);

  const compiled = useMemo(() => {
    try {
      return { scope: new PTSInterpreter(nodes as PTSNode[], reg).compileScope(scopeId), error: null as string | null };
    } catch (e) {
      return { scope: null, error: (e as Error).message };
    }
  }, [nodes, reg, scopeId]);

  const scope = compiled.scope;
  const columns: ColumnInfo[] = useMemo(() => (scope ? scope.columns : []), [scope]);

  const [rows, setRows] = useState<Row[]>(() => withTrailingBlank(initialRows ?? []));
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState<Edit | null>(null);
  const editingActive = useRef(false); // guards onBlur after Enter/Escape unmount the editor
  const gridRef = useRef<HTMLDivElement>(null);

  // Evaluate every non-blank row through the interpreter.
  const computed = useMemo(
    () => rows.map((row) => (scope && !isBlank(row) ? scope.evalRow(row) : null)),
    [rows, scope],
  );

  const filled = rows.filter((r) => !isBlank(r)).length;
  const title = scope?.name ?? "Table";

  // ---- state changes

  const applyRows = (next: Row[]) => {
    const normalized = withTrailingBlank(next);
    setRows(normalized);
    onRowsChange?.(normalized.filter((r) => !isBlank(r)));
    return normalized;
  };

  const moveTo = (r: number, c: number, rowCount = rows.length) => {
    setSel({ r: clamp(r, 0, rowCount - 1), c: clamp(c, 0, columns.length - 1) });
  };

  const select = (r: number, c: number) => {
    setSel({ r, c });
    gridRef.current?.focus();
  };

  const cellValue = (r: number, c: number) => {
    const col = columns[c];
    return col && col.kind === "input" ? (rows[r]?.[col.name] ?? "") : "";
  };

  const beginEdit = (r: number, c: number, draft: string) => {
    if (columns[c]?.kind !== "input") return; // formula columns are computed
    editingActive.current = true;
    setEditing({ r, c, draft });
  };

  const commit = (edit: Edit, value: string, move: Move) => {
    editingActive.current = false;
    setEditing(null);
    const col = columns[edit.c];
    let rowCount = rows.length;
    if (col && col.kind === "input") {
      const next = applyRows(rows.map((row, i) => (i === edit.r ? { ...row, [col.name]: value } : row)));
      rowCount = next.length;
    }
    if (move === "down") moveTo(edit.r + 1, edit.c, rowCount);
    else if (move === "right") moveTo(edit.r, edit.c + 1, rowCount);
    else if (move === "left") moveTo(edit.r, edit.c - 1, rowCount);
    else moveTo(edit.r, edit.c, rowCount);
    gridRef.current?.focus();
  };

  const cancelEdit = () => {
    editingActive.current = false;
    setEditing(null);
    gridRef.current?.focus();
  };

  const clearCell = () => {
    const col = columns[sel.c];
    if (!col || col.kind !== "input") return;
    applyRows(rows.map((row, i) => (i === sel.r ? { ...row, [col.name]: "" } : row)));
  };

  // ---- toolbar

  const insertRow = () => {
    applyRows([...rows.slice(0, sel.r), {}, ...rows.slice(sel.r)]);
  };

  const deleteRow = () => {
    const next = applyRows(rows.filter((_, i) => i !== sel.r));
    setSel((s) => ({ ...s, r: clamp(s.r, 0, next.length - 1) }));
  };

  const clearAll = () => {
    if (!window.confirm("Clear all rows?")) return;
    applyRows([]);
    setSel((s) => ({ ...s, r: 0 }));
  };

  const exportCsv = () => {
    const lines = [columns.map((c) => csvEscape(c.name)).join(",")];
    rows.forEach((row, r) => {
      if (isBlank(row)) return;
      lines.push(
        columns
          .map((col) =>
            csvEscape(col.kind === "input" ? (row[col.name] ?? "") : display(computed[r]?.[col.name], decimals).text),
          )
          .join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "") || "table"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- keyboard

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return; // the editor owns the keys while open
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
        e.preventDefault();
        return moveTo(sel.r + 1, sel.c);
      case "ArrowUp":
        e.preventDefault();
        return moveTo(sel.r - 1, sel.c);
      case "ArrowRight":
        e.preventDefault();
        return moveTo(sel.r, sel.c + 1);
      case "ArrowLeft":
        e.preventDefault();
        return moveTo(sel.r, sel.c - 1);
      case "Tab":
        e.preventDefault();
        return moveTo(sel.r, sel.c + (e.shiftKey ? -1 : 1));
      case "F2":
        e.preventDefault();
        return beginEdit(sel.r, sel.c, cellValue(sel.r, sel.c));
      case "Delete":
      case "Backspace":
        e.preventDefault();
        return clearCell();
      default:
        // Typing a character starts editing and replaces the content.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          beginEdit(sel.r, sel.c, e.key);
        }
    }
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!editing) return;
    const value = e.currentTarget.value;
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      commit(editing, value, "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      commit(editing, value, e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelEdit();
    }
  };

  // ---- derived display

  const selCol = columns[sel.c];
  const cellRef = `${colLetter(sel.c)}${sel.r + 1}`;
  const selResult = selCol?.kind === "formula" ? computed[sel.r]?.[selCol.name] : undefined;
  const selError = selResult && !selResult.ok && selResult.code !== "MISSING_INPUT" ? selResult.message : "";
  const barText = editing
    ? editing.draft
    : selCol
      ? selCol.kind === "input"
        ? cellValue(sel.r, sel.c)
        : `${selCol.expression ?? ""}${selError ? `   \u26a0 ${selError}` : ""}`
      : "";

  const stats = useMemo(() => {
    const values: number[] = [];
    if (selCol) {
      rows.forEach((row, i) => {
        if (selCol.kind === "input") {
          const t = (row[selCol.name] ?? "").trim();
          if (t !== "" && Number.isFinite(Number(t))) values.push(Number(t));
        } else {
          const res = computed[i]?.[selCol.name];
          if (res?.ok) values.push(res.value);
        }
      });
    }
    const sum = values.reduce((a, b) => a + b, 0);
    return { count: values.length, sum, avg: values.length ? sum / values.length : 0 };
  }, [rows, computed, selCol]);

  // ---- render

  if (!scope) {
    const err = (
      <div className="tv-dialog" role="alert">
        <div className="tv-error">Cannot build table: {compiled.error}</div>
      </div>
    );
    return modal ? <div className="tv-overlay">{err}</div> : err;
  }

  const body = (
    <div className="tv-dialog" role="dialog" aria-label={title}>
      <header className="tv-header">
        <div>
          <h2 className="tv-title">{title}</h2>
          <p className="tv-subtitle">
            {columns.length} columns, {filled} filled rows
          </p>
        </div>
        {onClose && (
          <button type="button" className="tv-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        )}
      </header>

      <div className="tv-toolbar">
        <button type="button" className="tv-btn" onClick={insertRow}>
          + Insert row
        </button>
        <button type="button" className="tv-btn" onClick={deleteRow}>
          Delete row
        </button>
        <button type="button" className="tv-btn" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" className="tv-btn" onClick={clearAll}>
          Clear all
        </button>
      </div>

      <div className="tv-formula-bar">
        <span className="tv-cellref" data-testid="cellref">
          {cellRef}
        </span>
        <span className="tv-fx">ƒx</span>
        <span className="tv-formula-text" data-testid="formula-text">
          {barText}
        </span>
      </div>

      <div className="tv-grid" tabIndex={0} ref={gridRef} onKeyDown={onGridKeyDown} data-testid="grid">
        <table style={{ minWidth: 40 + columns.length * 88 }}>
          <thead>
            <tr>
              <th className="tv-corner" />
              {columns.map((col, c) => (
                <th key={col.id} className={`tv-letter${c === sel.c ? " tv-active" : ""}`}>
                  {colLetter(c)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="tv-corner" />
              {columns.map((col) => (
                <th key={col.id} className="tv-colhead">
                  <div className="tv-colname">{col.name}</div>
                  <div className="tv-coltype">{col.typeLabel}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <th className={`tv-rownum${r === sel.r ? " tv-active" : ""}`}>{r + 1}</th>
                {columns.map((col, c) => {
                  const isSel = sel.r === r && sel.c === c;
                  const isEditing = !!editing && editing.r === r && editing.c === c;
                  const isFormula = col.kind === "formula";
                  const shown = isFormula ? display(computed[r]?.[col.name], decimals) : { text: row[col.name] ?? "" };
                  const showHint = isFormula && computed[r] === null; // the empty entry row
                  const cls = [
                    "tv-cell",
                    isFormula ? "tv-formula" : "",
                    isSel ? "tv-selected" : "",
                    "error" in shown && shown.error ? "tv-err" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <td
                      key={col.id}
                      className={cls}
                      title={"error" in shown ? shown.error : undefined}
                      onClick={() => select(r, c)}
                      onDoubleClick={() => {
                        select(r, c);
                        beginEdit(r, c, cellValue(r, c));
                      }}
                    >
                      {isEditing && editing ? (
                        <input
                          className="tv-editor"
                          autoFocus
                          value={editing.draft}
                          onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                          onKeyDown={onEditorKeyDown}
                          onFocus={(e) => {
                            const n = e.currentTarget.value.length;
                            e.currentTarget.setSelectionRange(n, n);
                          }}
                          onBlur={(e) => {
                            if (editingActive.current) commit(editing, e.currentTarget.value, "none");
                          }}
                        />
                      ) : showHint ? (
                        <span className="tv-fx-hint">ƒx</span>
                      ) : (
                        shown.text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="tv-status">
        <span>
          <strong>Ready</strong>
          <span className="tv-hint">Type to edit, Enter to move down, F2 to edit in place</span>
        </span>
        <span className="tv-stats" data-testid="stats">
          <span>Average: {fmt(stats.avg, decimals)}</span>
          <span>Count: {stats.count}</span>
          <span>Sum: {fmt(stats.sum, decimals)}</span>
        </span>
      </footer>
    </div>
  );

  return modal ? (
    <div
      className="tv-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {body}
    </div>
  ) : (
    body
  );
}

// Both import styles work:
//   import { TableView } from "./TableView";
//   import TableView from "./TableView";
export default TableView;
