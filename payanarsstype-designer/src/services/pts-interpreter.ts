/**
 * PayanarssType Script (PTS) interpreter  (v2: table-aware)
 * ----------------------------------------------------------
 * Model (Excel-style, no input statements):
 *   SCOPE    - a block of cells; becomes ONE TABLE. Each child cell is a COLUMN.
 *   CELL     - a named input column (A, B). Its value comes from the row being evaluated.
 *   FORMULA  - a named computed column (Sum, Difference, ...). Its single child is the
 *              root of an expression tree, re-evaluated for every row.
 *   OPERATOR - an expression node. Children are operands, evaluated in array order.
 *   REF      - a node whose PayanarssTypeId is the *Id of another node*.
 *              It means "the value of that node" (like =A1 in Excel).
 *
 * Resolution rule for a node's PayanarssTypeId (T), using the Id / ParentId hierarchy:
 *   1. T is in the registry                          -> that kind.
 *   2. T is the Id of a node INSIDE this scope       -> REF to that node (e.g. A, B).
 *   3. Otherwise T is a TYPE node: walk T -> ParentId -> ParentId ... and take the first
 *      ancestor that is in the registry, or whose Name is a known base type
 *      (TableType => scope, FormulaType / FunctionType / LogicalFunction => formula, Number => cell),
 *      or, below an "...Operator..." node, whose Name is an operator (+, Add, Division, ...).
 *   4. Nothing matches                               -> UNKNOWN_TYPE, listing the chain.
 *
 * Use compileScope() once, then evalRow() per row: validation happens once,
 * and one failing formula (e.g. #DIV/0!) never blanks the rest of the row.
 */

// ---------------------------------------------------------------- types

export interface PTSNode {
  Id: string;
  ParentId: string | null;
  Name?: string | null;
  PayanarssTypeId: string;
  Attributes?: unknown[];
  Description?: string | null;
  requiredFlags?: unknown[];
  alwaysOn?: boolean;
  Exp?: string | null;
}

export type ErrorCode =
  | "MISSING_INPUT"
  | "NOT_A_NUMBER"
  | "DIV_ZERO"
  | "CIRCULAR"
  | "UNKNOWN_TYPE"
  | "STRUCTURE";

export class PTSError extends Error {
  readonly code: ErrorCode;
  constructor(message: string, code: ErrorCode = "STRUCTURE") {
    super(message);
    this.name = "PTSError";
    this.code = code;
  }
}

export type Kind =
  | { kind: "scope" }
  | { kind: "cell" }
  | { kind: "formula" }
  | { kind: "operator"; op: string };

type Resolved = Kind | { kind: "ref"; target: PTSNode };

export type CellResult =
  | { ok: true; value: number }
  | { ok: false; code: ErrorCode; message: string };

export type RowInputs = Record<string, number | string | null | undefined>;

export interface ColumnInfo {
  id: string;
  name: string;
  kind: "input" | "formula";
  /** Display label for the column type, e.g. "Number", "FunctionType". */
  typeLabel: string;
  /** Formulas only: infix rendering of the expression tree, e.g. "=A + B". */
  expression?: string;
}

export interface CompiledScope {
  id: string;
  name: string;
  columns: ColumnInfo[];
  /** Evaluate every formula column for one row of input values (keyed by input column name). */
  evalRow(inputs: RowInputs): Record<string, CellResult>;
}

// ---------------------------------------------------------------- built-in registry
// ASSUMED mapping, inferred from the hierarchy. Replace with your real
// OperatorType / type nodes from VanakkamPayanarssTypes.json.

export const TYPE_ID = {
  SCOPE: "100000000000000000050000000000005",
  CELL: "100000000000000000000000000000007",
  // NOTE: this ID has 34 digits; every other ID has 33. Likely a typo upstream.
  FORMULA: "1000000000000000000410000000000000",
  ADD: "100000000000000000030000000000002",
} as const;

const DEFAULT_LABEL: Record<Kind["kind"], string> = {
  scope: "Scope",
  cell: "Number",
  formula: "FunctionType",
  operator: "Operator",
};

export class TypeRegistry {
  private kinds = new Map<string, Kind>();
  private labels = new Map<string, string>();

  register(typeId: string, kind: Kind, label?: string): this {
    this.kinds.set(typeId, kind);
    if (label) this.labels.set(typeId, label);
    return this;
  }

  registerOperator(typeId: string, op: string, label?: string): this {
    return this.register(typeId, { kind: "operator", op }, label);
  }

  get(typeId: string): Kind | undefined {
    return this.kinds.get(typeId);
  }

  /** Explicit label for a type Id, if one was registered. */
  customLabel(typeId: string): string | undefined {
    return this.labels.get(typeId);
  }

  static default(): TypeRegistry {
    return new TypeRegistry()
      .register(TYPE_ID.SCOPE, { kind: "scope" })
      .register(TYPE_ID.CELL, { kind: "cell" })
      .register(TYPE_ID.FORMULA, { kind: "formula" })
      .registerOperator(TYPE_ID.ADD, "add");
    // Register sub / mul / div / mod the same way once you have their IDs:
    //   registry.registerOperator("<id>", "sub");
  }
}

// ---------------------------------------------------------------- operators

type OpFn = (operands: number[]) => number;

const OPERATORS: Record<string, OpFn> = {
  add: (v) => v.reduce((a, b) => a + b),
  mul: (v) => v.reduce((a, b) => a * b),
  sub: (v) => v.reduce((a, b) => a - b),
  div: (v) =>
    v.reduce((a, b) => {
      if (b === 0) throw new PTSError("Division by zero", "DIV_ZERO");
      return a / b;
    }),
  mod: (v) =>
    v.reduce((a, b) => {
      if (b === 0) throw new PTSError("Modulo by zero", "DIV_ZERO");
      return a % b;
    }),
};

const OP_SYMBOL: Record<string, string> = { add: "+", sub: "-", mul: "*", div: "/", mod: "%" };

// ---------------------------------------------------------------- name-based type recognition
// Used while walking a type's ParentId chain, so subtypes (e.g. LogicalFunction under
// FormulaType) and operators defined in your type tree resolve without hard-coded Ids.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const KIND_BY_NAME: Record<string, "scope" | "cell" | "formula"> = {
  tabletype: "scope",
  table: "scope",
  scopetype: "scope",
  formulatype: "formula",
  functiontype: "formula",
  logicalfunction: "formula",
  number: "cell",
  numbertype: "cell",
};

const OP_BY_SYMBOL: Record<string, string> = {
  "+": "add", "-": "sub", "*": "mul", "/": "div", "%": "mod", "\u00d7": "mul", "\u00f7": "div",
};

const OP_BY_WORD: Record<string, string> = {
  add: "add", addition: "add", plus: "add", sum: "add",
  subtract: "sub", subtraction: "sub", minus: "sub",
  multiply: "mul", multiplication: "mul", times: "mul", product: "mul",
  divide: "div", division: "div", quotient: "div",
  modulo: "mod", modulus: "mod", mod: "mod", remainder: "mod",
};

function opFromName(name: string): string | undefined {
  const t = name.trim();
  if (OP_BY_SYMBOL[t]) return OP_BY_SYMBOL[t];
  const m = t.match(/\(\s*([+\-*/%\u00d7\u00f7])\s*\)/); // "Division (/)"
  if (m) return OP_BY_SYMBOL[m[1]];
  for (const w of t.toLowerCase().split(/[^a-z]+/)) {
    if (w && OP_BY_WORD[w]) return OP_BY_WORD[w];
  }
  return undefined;
}

const NO_SCOPE: ReadonlySet<string> = new Set();

// ---------------------------------------------------------------- parsing helper

/** Accepts a JSON array, or a pasted fragment like `{...},{...}` (no brackets). */
export function parseNodes(text: string): PTSNode[] {
  let t = text.trim().replace(/,\s*$/, "");
  if (!t.startsWith("[")) t = `[${t}]`;
  return JSON.parse(t) as PTSNode[];
}

/**
 * Accepts a flat PTSNode[], a Map/Set of nodes, or a plain object keyed by Id.
 * Anything else gets a clear error instead of "nodes is not iterable".
 */
export function toNodeArray(input: unknown): PTSNode[] {
  if (Array.isArray(input)) return input as PTSNode[];
  if (input instanceof Map || input instanceof Set) return [...input.values()] as PTSNode[];
  if (input && typeof input === "object") {
    const vals = Object.values(input as Record<string, unknown>);
    if (vals.length > 0 && vals.every((v) => v && typeof v === "object" && "Id" in v)) {
      return vals as PTSNode[];
    }
  }
  const got = input === undefined ? "undefined" : input === null ? "null" : typeof input;
  throw new PTSError(
    `TableView needs a flat array of PTS nodes in the "nodes" prop, but got ${got}. ` +
      `If the designer still passes its old props, pass nodes={...} and scopeId={...}.`,
  );
}

// ---------------------------------------------------------------- interpreter

export class PTSInterpreter {
  private byId = new Map<string, PTSNode>();
  private children = new Map<string, PTSNode[]>();
  private registry: TypeRegistry;

  constructor(nodes: PTSNode[], registry: TypeRegistry = TypeRegistry.default()) {
    this.registry = registry;
    nodes = toNodeArray(nodes);
    for (const n of nodes) {
      if (this.byId.has(n.Id)) throw new PTSError(`Duplicate node Id: ${n.Id}`);
      this.byId.set(n.Id, n);
    }
    // Array order is preserved: it defines operand order for sub/div/mod.
    for (const n of nodes) {
      if (n.ParentId == null) continue;
      if (!this.children.has(n.ParentId)) this.children.set(n.ParentId, []);
      this.children.get(n.ParentId)!.push(n);
    }
  }

  private kids(id: string): PTSNode[] {
    return this.children.get(id) ?? [];
  }

  private label(n: PTSNode): string {
    return n.Name ? `${n.Name} (${n.Id})` : n.Id;
  }

  /** Ids of a type and its ancestors, nearest first (guards against cycles). */
  private typeChain(typeId: string): string[] {
    const chain: string[] = [];
    const seen = new Set<string>();
    let id: string | null | undefined = typeId;
    while (id && !seen.has(id) && chain.length < 64) {
      seen.add(id);
      chain.push(id);
      id = this.byId.get(id)?.ParentId;
    }
    return chain;
  }

  private kindFromTypeChain(chain: string[]): Kind | undefined {
    for (const id of chain) {
      const k = this.registry.get(id);
      if (k) return k;
      const name = this.byId.get(id)?.Name;
      const byName = name ? KIND_BY_NAME[norm(name)] : undefined;
      if (byName) return { kind: byName };
    }
    // Operators by name, only when the chain sits under an "...Operator..." node.
    const underOperator = chain.some((id) => norm(this.byId.get(id)?.Name ?? "").includes("operator"));
    if (underOperator) {
      for (const id of chain) {
        const name = this.byId.get(id)?.Name;
        const op = name ? opFromName(name) : undefined;
        if (op) return { kind: "operator", op };
      }
    }
    return undefined;
  }

  private resolve(n: PTSNode, inScope: ReadonlySet<string>): Resolved {
    const tid = n.PayanarssTypeId;
    const direct = this.registry.get(tid);
    if (direct) return direct;

    const target = this.byId.get(tid);
    if (target && inScope.has(tid)) return { kind: "ref", target };

    const chain = this.typeChain(tid);
    const found = this.kindFromTypeChain(chain);
    if (found) return found;

    const names = chain.map((id) => this.byId.get(id)?.Name ?? id);
    throw new PTSError(
      `Unknown type for node ${this.label(n)}: ${names.join(" -> ")}. ` +
        `Register it (registry.register / registerOperator) or add its base type to the hierarchy.`,
      "UNKNOWN_TYPE",
    );
  }

  /** Infix text of a formula body, e.g. "A + B". Never throws. */
  private exprText(n: PTSNode, top: boolean, inScope: ReadonlySet<string>): string {
    try {
      const r = this.resolve(n, inScope);
      switch (r.kind) {
        case "ref":
          return r.target.Name ?? r.target.Id;
        case "cell":
        case "formula":
          return n.Name ?? n.Id;
        case "operator": {
          const sym = OP_SYMBOL[r.op] ?? r.op;
          const text = this.kids(n.Id)
            .map((c) => this.exprText(c, false, inScope))
            .join(` ${sym} `);
          return top ? text : `(${text})`;
        }
        default:
          return "?";
      }
    } catch {
      return "?";
    }
  }

  /** Validate a scope once and return its columns plus a per-row evaluator. */
  compileScope(scopeId: string): CompiledScope {
    const scope = this.byId.get(scopeId);
    if (!scope) throw new PTSError(`Scope not found: ${scopeId}`);
    if (this.resolve(scope, NO_SCOPE).kind !== "scope") {
      throw new PTSError(`Node ${this.label(scope)} is not a scope`);
    }

    // Every node under the scope: a PayanarssTypeId pointing at one of these is a reference.
    const inScope = new Set<string>([scope.Id]);
    const stack = [scope.Id];
    while (stack.length) {
      for (const k of this.kids(stack.pop()!)) {
        if (!inScope.has(k.Id)) {
          inScope.add(k.Id);
          stack.push(k.Id);
        }
      }
    }

    const columns: ColumnInfo[] = [];
    const formulas: PTSNode[] = [];
    const seen = new Set<string>();

    for (const c of this.kids(scope.Id)) {
      const kind = this.resolve(c, inScope).kind;
      if (kind === "scope") continue; // nested scopes are not columns
      if (kind !== "cell" && kind !== "formula") {
        throw new PTSError(`Scope child ${this.label(c)} must be a cell or formula, got ${kind}`);
      }
      const name = c.Name ?? "";
      if (!name) throw new PTSError(`Unnamed cell under scope ${this.label(scope)}`);
      if (seen.has(name)) throw new PTSError(`Duplicate cell name "${name}" in scope`);
      seen.add(name);

      const typeLabel =
        this.registry.customLabel(c.PayanarssTypeId) ??
        this.byId.get(c.PayanarssTypeId)?.Name ??
        DEFAULT_LABEL[kind];
      if (kind === "cell") {
        columns.push({ id: c.Id, name, kind: "input", typeLabel });
      } else {
        const body = this.kids(c.Id);
        const expression = body.length === 1 ? `=${this.exprText(body[0], true, inScope)}` : undefined;
        columns.push({ id: c.Id, name, kind: "formula", typeLabel, expression });
        formulas.push(c);
      }
    }

    const evalRow = (inputs: RowInputs): Record<string, CellResult> => {
      const memo = new Map<string, number>();
      const visiting = new Set<string>();

      const evalNode = (n: PTSNode): number => {
        const r = this.resolve(n, inScope);

        switch (r.kind) {
          case "cell": {
            if (n.ParentId !== scope.Id) {
              throw new PTSError(`Cell ${this.label(n)} is outside the scope being evaluated`);
            }
            const raw = inputs[n.Name ?? ""];
            if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
              throw new PTSError(`Missing input for cell "${n.Name}"`, "MISSING_INPUT");
            }
            const v = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(v)) {
              throw new PTSError(`Input "${n.Name}" is not a number: ${raw}`, "NOT_A_NUMBER");
            }
            return v;
          }

          case "formula": {
            if (memo.has(n.Id)) return memo.get(n.Id)!;
            if (visiting.has(n.Id)) throw new PTSError(`Circular reference at ${this.label(n)}`, "CIRCULAR");
            visiting.add(n.Id);
            try {
              const body = this.kids(n.Id);
              if (body.length !== 1) {
                throw new PTSError(
                  `Formula ${this.label(n)} needs exactly 1 child expression, found ${body.length}`,
                );
              }
              const v = evalNode(body[0]);
              memo.set(n.Id, v);
              return v;
            } finally {
              visiting.delete(n.Id);
            }
          }

          case "operator": {
            const fn = OPERATORS[r.op];
            if (!fn) throw new PTSError(`Operator "${r.op}" has no implementation`);
            const operands = this.kids(n.Id).map(evalNode);
            if (operands.length < 2) {
              throw new PTSError(`Operator "${r.op}" needs at least 2 operands, found ${operands.length}`);
            }
            return fn(operands);
          }

          case "ref":
            return evalNode(r.target);

          case "scope":
            throw new PTSError(`A scope cannot be used as a value (${this.label(n)})`);
        }
      };

      const out: Record<string, CellResult> = {};
      for (const f of formulas) {
        try {
          out[f.Name!] = { ok: true, value: evalNode(f) };
        } catch (e) {
          if (e instanceof PTSError) out[f.Name!] = { ok: false, code: e.code, message: e.message };
          else throw e;
        }
      }
      return out;
    };

    return { id: scope.Id, name: scope.Name ?? scope.Id, columns, evalRow };
  }

  /** Convenience: evaluate one row and throw on the first error. */
  run(scopeId: string, inputs: RowInputs): Record<string, number> {
    const results = this.compileScope(scopeId).evalRow(inputs);
    const out: Record<string, number> = {};
    for (const [name, r] of Object.entries(results)) {
      if (!r.ok) throw new PTSError(r.message, r.code);
      out[name] = r.value;
    }
    return out;
  }
}
