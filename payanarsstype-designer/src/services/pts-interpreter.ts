/**
 * PayanarssType Script (PTS) interpreter  (v2: table-aware)
 * ----------------------------------------------------------
 * Model (Excel-style, no input statements):
 *   SCOPE    - a block of cells; becomes ONE TABLE. Each child cell is a COLUMN.
 *   CELL     - a named input column (A, B). Its value comes from the row being evaluated.
 *   FORMULA  - a named computed column (Sum, Difference, ...). Its single child is the
 *              root of an expression tree, re-evaluated for every row.
 *   OPERATOR - an arithmetic expression node (+ - * / %). Children are operands, in array order.
 *   COMPARISON - ==  !=  >  <  >=  <=  : exactly two operands, returns true/false.
 *   LOGICAL  - &&  ||  !  (AND / OR / NOT). && and || take 2+ operands and short-circuit;
 *              ! takes exactly 1. Operands must be true/false.
 *   LITERAL  - a ConstantType node; its Name (or Value) is the constant: 10, 50, True, False.
 *              Constants sitting directly under a scope are NOT columns; reference them like cells.
 *   RETURNS  - a `Returns` node: yields its Value/Name literal (True, 42) or, if it has one
 *              child, that child's expression.
 *   LOOP     - `for`. Children: the condition, then body statements in order. Loop variables are
 *              Number-typed nodes with a start Value (e.g. "<FromNumber/>"). They may sit under the
 *              `for` node OR anywhere else in the tree (e.g. a separate "variables" container) and be
 *              referenced by Id; either way the loop initialises them when it starts.
 *              A body statement is `Returns` (adds its value to the loop's result LIST) or
 *              `++` / `--` (changes a loop variable). The cell's value is the list.
 *   INCDEC   - ++ / -- (prefix or postfix) on a loop variable. Postfix yields the old value.
 *   BRANCH   - if / else if / else (AttributeType nodes). Child order is meaningful:
 *                if, else if :  [condition, value, (else if | else)?]
 *                else        :  [value]
 *              Only the taken branch is evaluated (so `if (B != 0) A / B else 0` is safe).
 *   REF      - a node whose PayanarssTypeId is the *Id of another node*.
 *              It means "the value of that node" (like =A1 in Excel).
 *
 * Resolution rule for a node's PayanarssTypeId (T), using the Id / ParentId hierarchy:
 *   1. T is in the registry                          -> that kind.
 *   2. T is the Id of a node INSIDE this scope       -> REF to that node (e.g. A, B).
 *      T is the Id of a CONSTANT anywhere in the tree -> REF too (constants are shared values,
 *      so they may live outside the scope, e.g. 400 / 100 / 4 / 0 for the leap-year rule).
 *   3. Otherwise T is a TYPE node: walk T -> ParentId -> ParentId ... and take the first
 *      ancestor that is in the registry, or whose Name is a known base type
 *      (TableType / Program => scope, FormulaType / FunctionType / LogicalFunction => formula, Number => cell),
 *      or, below an "...Operator..." node, whose Name is an operator (+, >=, Add, Division, ...),
 *      or, below an "AttributeType" node, whose Name is if / else if / else.
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
  /** Literal payload for Returns / constant nodes, e.g. "True". Falls back to Name. */
  Value?: string | number | boolean | null;
}

export type ErrorCode =
  | "MISSING_INPUT"
  | "NOT_A_NUMBER"
  | "DIV_ZERO"
  | "CIRCULAR"
  | "UNKNOWN_TYPE"
  | "TYPE_MISMATCH" // e.g. adding a true/false value, or a non-boolean `if` condition
  | "NO_VALUE" // `if` chain with no matching branch and no `else`
  | "LOOP_LIMIT" // a loop ran more than MAX_LOOP_ITERATIONS times
  | "STRUCTURE";

export class PTSError extends Error {
  readonly code: ErrorCode;
  constructor(message: string, code: ErrorCode = "STRUCTURE") {
    super(message);
    this.name = "PTSError";
    this.code = code;
  }
}

export type Branch = "if" | "elseif" | "else";

export type Scalar = number | boolean;

/** What an expression produces: a number, true/false, or (from a loop) a list of those. */
export type Value = Scalar | Scalar[];

/** Total loop iterations allowed per evaluated row; stops runaway loops. */
export const MAX_LOOP_ITERATIONS = 100_000;

export type Kind =
  | { kind: "scope" }
  | { kind: "cell" }
  | { kind: "formula" }
  | { kind: "operator"; op: string }
  | { kind: "comparison"; op: string }
  | { kind: "logical"; op: "and" | "or" | "not" }
  | { kind: "literal" }
  | { kind: "returns" }
  | { kind: "loop"; loop: "for" }
  | { kind: "incdec"; op: "inc" | "dec"; prefix: boolean }
  | { kind: "branch"; branch: Branch };

type Resolved = Kind | { kind: "ref"; target: PTSNode };

export type CellResult =
  | { ok: true; value: Value }
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
// IDs below are taken from VanakkamPayanarssTypes.json. Anything not listed here is still
// recognised through the ParentId chain + names (see kindFromTypeChain).

export const TYPE_ID = {
  SCOPE: "100000000000000000050000000000005",
  CELL: "100000000000000000000000000000007",
  FORMULA: "1000000000000000000410000000000000", // "FunctionType" (34 digits in the file, as stored)
  ADD: "100000000000000000030000000000002",
  SUB: "100000000000000000030000000000003",
  MUL: "100000000000000000030000000000004",
  DIV: "100000000000000000030000000000005",
  MOD: "100000000000000000030000000000006",
  // ComparisonOperator children
  EQ: "100000000000000000030000000000011",
  NEQ: "100000000000000000030000000000012",
  GT: "100000000000000000030000000000013",
  LT: "100000000000000000030000000000014",
  GTE: "100000000000000000030000000000015",
  LTE: "100000000000000000030000000000016",
  // LogicalOperator children
  AND: "100000000000000000030000000000021",
  OR: "100000000000000000030000000000022",
  NOT: "100000000000000000030000000000023",
  // ValueType / FunctionType children
  CONSTANT: "111000000000000000000000000000000", // "ConstantType": Name holds the value
  RETURNS: "1000000000000000000411000000000000", // "Returns": Value holds True / False / a number
  // IncrementDecrementOperator children
  INC_PREFIX: "100000000000000000030000000000041",
  INC_POSTFIX: "100000000000000000030000000000042",
  DEC_PREFIX: "100000000000000000030000000000043",
  DEC_POSTFIX: "100000000000000000030000000000044",
  // AttributeType children
  FOR: "100000000000000000010000000000008",
  IF: "100000000000000000010000000000001",
  ELSE: "100000000000000000010000000000002",
  ELSE_IF: "100000000000000000010000000000003",
} as const;

const DEFAULT_LABEL: Record<Kind["kind"], string> = {
  scope: "Scope",
  cell: "Number",
  formula: "FunctionType",
  operator: "Operator",
  comparison: "ComparisonOperator",
  logical: "LogicalOperator",
  literal: "ConstantType",
  returns: "Returns",
  loop: "AttributeType",
  incdec: "IncrementDecrementOperator",
  branch: "AttributeType",
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

  registerComparison(typeId: string, op: string, label?: string): this {
    return this.register(typeId, { kind: "comparison", op }, label);
  }

  registerLogical(typeId: string, op: "and" | "or" | "not", label?: string): this {
    return this.register(typeId, { kind: "logical", op }, label);
  }

  registerIncDec(typeId: string, op: "inc" | "dec", prefix: boolean, label?: string): this {
    return this.register(typeId, { kind: "incdec", op, prefix }, label);
  }

  registerBranch(typeId: string, branch: Branch, label?: string): this {
    return this.register(typeId, { kind: "branch", branch }, label);
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
      .registerOperator(TYPE_ID.ADD, "add")
      .registerOperator(TYPE_ID.SUB, "sub")
      .registerOperator(TYPE_ID.MUL, "mul")
      .registerOperator(TYPE_ID.DIV, "div")
      .registerOperator(TYPE_ID.MOD, "mod")
      .registerComparison(TYPE_ID.EQ, "eq")
      .registerComparison(TYPE_ID.NEQ, "neq")
      .registerComparison(TYPE_ID.GT, "gt")
      .registerComparison(TYPE_ID.LT, "lt")
      .registerComparison(TYPE_ID.GTE, "gte")
      .registerComparison(TYPE_ID.LTE, "lte")
      .registerLogical(TYPE_ID.AND, "and")
      .registerLogical(TYPE_ID.OR, "or")
      .registerLogical(TYPE_ID.NOT, "not")
      .register(TYPE_ID.CONSTANT, { kind: "literal" })
      .register(TYPE_ID.RETURNS, { kind: "returns" })
      .register(TYPE_ID.FOR, { kind: "loop", loop: "for" })
      .registerIncDec(TYPE_ID.INC_PREFIX, "inc", true)
      .registerIncDec(TYPE_ID.INC_POSTFIX, "inc", false)
      .registerIncDec(TYPE_ID.DEC_PREFIX, "dec", true)
      .registerIncDec(TYPE_ID.DEC_POSTFIX, "dec", false)
      .registerBranch(TYPE_ID.IF, "if")
      .registerBranch(TYPE_ID.ELSE_IF, "elseif")
      .registerBranch(TYPE_ID.ELSE, "else");
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

/** Comparison functions. Ordering comparisons are only reached with numbers (checked by the caller). */
const COMPARATORS: Record<string, (a: Scalar, b: Scalar) => boolean> = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => Number(a) > Number(b),
  lt: (a, b) => Number(a) < Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lte: (a, b) => Number(a) <= Number(b),
};

const OP_SYMBOL: Record<string, string> = {
  add: "+", sub: "-", mul: "*", div: "/", mod: "%",
  eq: "==", neq: "!=", gt: ">", lt: "<", gte: ">=", lte: "<=",
  and: "&&", or: "||", not: "!",
  inc: "++", dec: "--",
};

const branchName = (b: Branch) => (b === "elseif" ? "else if" : b);

/** Own-property lookup, so a type named "constructor" or "toString" can never match a table entry. */
function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

const describeValue = (v: Value) => (Array.isArray(v) ? "a list" : typeof v === "boolean" ? "a true/false value" : "a number");

function asBoolean(v: Value, what: string): boolean {
  if (typeof v !== "boolean") {
    throw new PTSError(`"${what}" needs true/false values, but got ${describeValue(v)}`, "TYPE_MISMATCH");
  }
  return v;
}

function asScalar(v: Value, what: string): Scalar {
  if (Array.isArray(v)) throw new PTSError(`"${what}" cannot use a list here`, "TYPE_MISMATCH");
  return v;
}

/** Value of a constant / Returns node: Value first, then Name. Accepts 10, "10", True, "false". */
function literalValue(n: PTSNode): Scalar {
  const raw = n.Value ?? n.Name;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const t = typeof raw === "string" ? raw.trim() : "";
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  const v = t === "" ? NaN : Number(t);
  if (!Number.isFinite(v)) {
    throw new PTSError(`Constant "${t}" is not a number or True/False (node ${n.Id})`, "STRUCTURE");
  }
  return v;
}

function asNumber(v: Value, what: string): number {
  if (typeof v !== "number") {
    throw new PTSError(`"${what}" needs numbers, but got ${describeValue(v)}`, "TYPE_MISMATCH");
  }
  return v;
}

// ---------------------------------------------------------------- name-based type recognition
// Used while walking a type's ParentId chain, so subtypes (e.g. LogicalFunction under
// FormulaType) and operators defined in your type tree resolve without hard-coded Ids.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const KIND_BY_NAME: Record<string, "scope" | "cell" | "formula" | "literal"> = {
  constanttype: "literal",
  tabletype: "scope",
  table: "scope",
  scopetype: "scope",
  program: "scope",
  formulatype: "formula",
  functiontype: "formula",
  logicalfunction: "formula",
  number: "cell",
  numbertype: "cell",
};

const OP_BY_SYMBOL: Record<string, string> = {
  "+": "add", "-": "sub", "*": "mul", "/": "div", "%": "mod", "\u00d7": "mul", "\u00f7": "div",
};

const CMP_BY_SYMBOL: Record<string, string> = {
  "==": "eq", "!=": "neq", "<>": "neq", ">": "gt", "<": "lt", ">=": "gte", "<=": "lte",
};

// matched against norm(name), so "Not Equal To" -> "notequalto"
const CMP_BY_NAME: Record<string, string> = {
  equal: "eq", equals: "eq", equalto: "eq", notequal: "neq", notequalto: "neq",
  greaterthan: "gt", lessthan: "lt",
  greaterthanorequal: "gte", greaterthanorequalto: "gte",
  lessthanorequal: "lte", lessthanorequalto: "lte",
};

const LOGICAL_BY_SYMBOL: Record<string, "and" | "or" | "not"> = { "&&": "and", "||": "or", "!": "not" };
const LOGICAL_BY_NAME: Record<string, "and" | "or" | "not"> = {
  and: "and", logicaland: "and", or: "or", logicalor: "or", not: "not", logicalnot: "not",
};

const BRANCH_BY_NAME: Record<string, Branch> = { if: "if", elseif: "elseif", else: "else" };

const OP_BY_WORD: Record<string, string> = {
  add: "add", addition: "add", plus: "add", sum: "add",
  subtract: "sub", subtraction: "sub", minus: "sub",
  multiply: "mul", multiplication: "mul", times: "mul", product: "mul",
  divide: "div", division: "div", quotient: "div",
  modulo: "mod", modulus: "mod", mod: "mod", remainder: "mod",
};

/** Operator or comparison from a type node's Name: "+", ">=", "Division (/)", "Not Equal"... */
function opKindFromName(name: string): Kind | undefined {
  const t = name.trim();

  const cmpSym = own(CMP_BY_SYMBOL, t);
  if (cmpSym) return { kind: "comparison", op: cmpSym };
  const opSym = own(OP_BY_SYMBOL, t);
  if (opSym) return { kind: "operator", op: opSym };

  const cmpName = own(CMP_BY_NAME, norm(t));
  if (cmpName) return { kind: "comparison", op: cmpName };

  const m = t.match(/\(\s*(==|!=|<>|>=|<=|>|<|[+\-*/%\u00d7\u00f7])\s*\)/); // "Greater Than (>)"
  if (m) {
    const c = own(CMP_BY_SYMBOL, m[1]);
    if (c) return { kind: "comparison", op: c };
    const o = own(OP_BY_SYMBOL, m[1]);
    if (o) return { kind: "operator", op: o };
  }

  for (const w of t.toLowerCase().split(/[^a-z]+/)) {
    const o = w ? own(OP_BY_WORD, w) : undefined;
    if (o) return { kind: "operator", op: o };
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
    const nameOf = (id: string) => norm(this.byId.get(id)?.Name ?? "");
    const underFunction = chain.some((id) => nameOf(id) === "functiontype");
    for (const id of chain) {
      const k = this.registry.get(id);
      if (k) return k;
      const nm = nameOf(id);
      // "Returns" is a FunctionType child, so test it before FunctionType itself matches.
      if (nm === "returns" && underFunction) return { kind: "returns" };
      const byName = nm ? own(KIND_BY_NAME, nm) : undefined;
      if (byName) return { kind: byName };
    }
    // && || ! (AND / OR / NOT), only under a "LogicalOperator" node.
    if (chain.some((id) => nameOf(id) === "logicaloperator")) {
      for (const id of chain) {
        const name = this.byId.get(id)?.Name?.trim();
        const op = name ? (own(LOGICAL_BY_SYMBOL, name) ?? own(LOGICAL_BY_NAME, norm(name))) : undefined;
        if (op) return { kind: "logical", op };
      }
    }
    // Operators by name, only when the chain sits under an "...Operator..." node.
    const underOperator = chain.some((id) => norm(this.byId.get(id)?.Name ?? "").includes("operator"));
    if (underOperator) {
      for (const id of chain) {
        const name = this.byId.get(id)?.Name;
        const k = name ? opKindFromName(name) : undefined;
        if (k) return k;
      }
    }
    // ++ -- (prefix / postfix), only under an "IncrementDecrementOperator" node.
    if (chain.some((id) => nameOf(id) === "incrementdecrementoperator")) {
      for (const id of chain) {
        const name = this.byId.get(id)?.Name;
        const m = name ? /(\+\+|--)/.exec(name) : null;
        if (name && m) return { kind: "incdec", op: m[1] === "++" ? "inc" : "dec", prefix: !/postfix/i.test(name) };
      }
    }
    // if / else if / else / for, only when the chain sits under an "AttributeType" node.
    const underAttribute = chain.some((id) => norm(this.byId.get(id)?.Name ?? "") === "attributetype");
    if (underAttribute) {
      for (const id of chain) {
        const name = this.byId.get(id)?.Name;
        const branch = name ? own(BRANCH_BY_NAME, norm(name)) : undefined;
        if (branch) return { kind: "branch", branch };
        if (name && norm(name) === "for") return { kind: "loop", loop: "for" };
      }
    }
    return undefined;
  }

  /** True when the node is a constant (its type is, or descends from, ConstantType). */
  private isConstant(n: PTSNode): boolean {
    const t = n.PayanarssTypeId;
    const k = this.registry.get(t) ?? this.kindFromTypeChain(this.typeChain(t));
    return k?.kind === "literal";
  }

  /** Kind of a node from its own type (registry or hierarchy); never throws, ignores references. */
  private kindOf(n: PTSNode | undefined): Kind | undefined {
    if (!n) return undefined;
    const t = n.PayanarssTypeId;
    return this.registry.get(t) ?? this.kindFromTypeChain(this.typeChain(t));
  }

  /**
   * A declared variable: a Number-typed cell with a start Value whose parent is not a scope
   * (so it is not a table input). Loop counters such as `i` are variables.
   */
  private isVariable(n: PTSNode): boolean {
    const v = n.Value;
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return false;
    return this.kindOf(n)?.kind === "cell" && this.kindOf(this.byId.get(n.ParentId ?? ""))?.kind !== "scope";
  }

  /** Variables a for-loop owns: its Number-typed children plus any declared variable its nodes reference. */
  private loopVariables(loop: PTSNode, inScope: ReadonlySet<string>): PTSNode[] {
    const vars = new Map<string, PTSNode>();
    const walk = (id: string) => {
      for (const k of this.kids(id)) {
        const r = this.resolve(k, inScope);
        if (r.kind === "cell") vars.set(k.Id, k);
        else if (r.kind === "ref" && this.isVariable(r.target)) vars.set(r.target.Id, r.target);
        if (r.kind !== "cell") walk(k.Id);
      }
    };
    walk(loop.Id);
    return [...vars.values()];
  }

  /** True when the node's own type is a recognised kind, i.e. it is a cell / formula / constant, not a type definition. */
  private isInstance(n: PTSNode): boolean {
    const t = n.PayanarssTypeId;
    return !!(this.registry.get(t) ?? this.kindFromTypeChain(this.typeChain(t)));
  }

  private resolve(n: PTSNode, inScope: ReadonlySet<string>): Resolved {
    const tid = n.PayanarssTypeId;
    const direct = this.registry.get(tid);
    if (direct) return direct;

    const target = this.byId.get(tid);
    if (target && (inScope.has(tid) || this.isConstant(target) || this.isVariable(target))) {
      return { kind: "ref", target };
    }

    const chain = this.typeChain(tid);
    const found = this.kindFromTypeChain(chain);
    if (found) return found;

    const names = chain.map((id) => this.byId.get(id)?.Name ?? id);

    // The Id points at an existing node that is a cell / formula / constant, just not inside
    // this scope (e.g. a loop variable whose ParentId was never updated).
    if (target && this.isInstance(target)) {
      const brokenParent = chain.some((id) => {
        const p = this.byId.get(id)?.ParentId;
        return !!p && !this.byId.has(p);
      });
      throw new PTSError(
        `Node ${this.label(n)} refers to "${target.Name ?? tid}", but that node is outside the scope being ` +
          `evaluated (parent chain: ${names.join(" -> ")}${brokenParent ? "; a parent in this chain does not exist" : ""}). ` +
          `Give it a ParentId inside the scope (a loop variable goes under its for node).`,
        "STRUCTURE",
      );
    }
    // The Id matches nothing at all: deleted or stale reference.
    if (!target && chain.length === 1) {
      throw new PTSError(
        `Node ${this.label(n)} refers to "${tid}", which is neither a known type nor an existing node (deleted or stale Id?)`,
        "UNKNOWN_TYPE",
      );
    }
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
        case "operator":
        case "comparison": {
          const sym = OP_SYMBOL[r.op] ?? r.op;
          const text = this.kids(n.Id)
            .map((c) => this.exprText(c, false, inScope))
            .join(` ${sym} `);
          return top ? text : `(${text})`;
        }
        case "logical": {
          const parts = this.kids(n.Id).map((c) => this.exprText(c, false, inScope));
          const text = r.op === "not" ? `!${parts[0] ?? "?"}` : parts.join(` ${OP_SYMBOL[r.op]} `);
          return top ? text : `(${text})`;
        }
        case "incdec": {
          const operand = this.kids(n.Id)[0];
          const t = operand ? this.exprText(operand, true, inScope) : "?";
          const sym = OP_SYMBOL[r.op];
          const text = r.prefix ? `${sym}${t}` : `${t}${sym}`;
          return top ? text : `(${text})`;
        }
        case "loop": {
          const text = this.loopText(n, inScope);
          return top ? text : `(${text})`;
        }
        case "literal":
          return String(n.Value ?? n.Name ?? n.Id);
        case "returns": {
          const body = this.kids(n.Id);
          return body.length === 1 ? this.exprText(body[0], top, inScope) : String(n.Value ?? n.Name ?? "?");
        }
        case "branch": {
          const text = this.branchText(n, inScope);
          return top ? text : `(${text})`;
        }
        default:
          return "?";
      }
    } catch {
      return "?";
    }
  }

  /** "for (i = FromNumber; (i >= FromNumber) && (i <= ToNumber)) { yield i; i++ }". Never throws past exprText. */
  private loopText(n: PTSNode, inScope: ReadonlySet<string>): string {
    const kids = this.kids(n.Id);
    const decls = this.loopVariables(n, inScope);
    const rest = kids.filter((c) => this.resolve(c, inScope).kind !== "cell");
    const init = decls
      .map((d) => {
        const m = typeof d.Value === "string" ? /^\s*<([^/>\s]+)\s*\/>\s*$/.exec(d.Value) : null;
        const start = m ? (this.byId.get(m[1])?.Name ?? m[1]) : String(d.Value ?? "?");
        return `${d.Name ?? d.Id} = ${start}`;
      })
      .join(", ");
    const cond = rest[0] ? this.exprText(rest[0], true, inScope) : "?";
    const body = rest
      .slice(1)
      .map((st) => {
        if (this.resolve(st, inScope).kind !== "returns") return this.exprText(st, true, inScope);
        const b = this.kids(st.Id);
        return `yield ${b.length === 1 ? this.exprText(b[0], true, inScope) : String(st.Value ?? st.Name ?? "?")}`;
      })
      .join("; ");
    return `for (${init}; ${cond}) { ${body} }`;
  }

  /** True for `else if` / `else` nodes, i.e. the "next branch" of an if chain. */
  private isChainLink(c: PTSNode, inScope: ReadonlySet<string>): boolean {
    const k = this.resolve(c, inScope);
    return k.kind === "branch" && k.branch !== "if";
  }

  /** "if (A > B) A else if (B > A) B else A". Called inside exprText's try/catch. */
  private branchText(n: PTSNode, inScope: ReadonlySet<string>): string {
    const r = this.resolve(n, inScope);
    if (r.kind !== "branch") return "?";
    const kids = this.kids(n.Id);
    let head = "else";
    let rest = kids;
    if (r.branch !== "else") {
      const cond = kids.length ? this.exprText(kids[0], true, inScope) : "?";
      head = `${branchName(r.branch)} (${cond})`;
      rest = kids.slice(1);
    }
    const body = rest
      .filter((c) => !this.isChainLink(c, inScope))
      .map((c) => this.exprText(c, true, inScope))
      .join(", ");
    const next = rest.find((c) => this.isChainLink(c, inScope));
    return `${head} ${body}${next ? ` ${this.branchText(next, inScope)}` : ""}`;
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
      if (kind === "scope" || kind === "literal") continue; // nested scopes and constants are not columns
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
      const memo = new Map<string, Value>();
      const visiting = new Set<string>();
      const locals = new Map<string, Scalar>(); // loop variables, alive only inside their loop
      let steps = 0; // loop iterations used by this row

      /** One link of an if / else if / else chain. Only the taken branch is evaluated. */
      const evalBranch = (n: PTSNode, branch: Branch): Value => {
        const name = branchName(branch);
        const kids = this.kids(n.Id);
        let rest = kids;
        if (branch !== "else") {
          if (kids.length === 0) throw new PTSError(`"${name}" needs a condition (${this.label(n)})`);
          rest = kids.slice(1);
        }
        const links = rest.filter((c) => this.isChainLink(c, inScope));
        const body = rest.filter((c) => !this.isChainLink(c, inScope));
        if (body.length !== 1) {
          throw new PTSError(
            `"${name}" needs exactly 1 value expression after its condition, found ${body.length} (${this.label(n)})`,
          );
        }
        if (links.length > 1 || (links.length === 1 && rest[rest.length - 1] !== links[0])) {
          throw new PTSError(`"${name}" may have at most one else if / else, and it must be the last child (${this.label(n)})`);
        }
        if (branch === "else" && links.length > 0) {
          throw new PTSError(`"else" cannot be followed by another branch (${this.label(n)})`);
        }

        let taken = true;
        if (branch !== "else") {
          const cond = evalNode(kids[0]);
          if (typeof cond !== "boolean") {
            throw new PTSError(`The condition of "${name}" must be a comparison (true/false)`, "TYPE_MISMATCH");
          }
          taken = cond;
        }
        if (taken) return evalNode(body[0]);

        if (links.length === 1) {
          const next = this.resolve(links[0], inScope);
          if (next.kind === "branch") return evalBranch(links[0], next.branch);
        }
        throw new PTSError(`No branch matched and there is no "else" (${this.label(n)})`, "NO_VALUE");
      };

      /** Start value of a loop variable: its Value, either "<NodeId/>" or a literal. */
      const initialValue = (d: PTSNode): Scalar => {
        const raw = d.Value;
        if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
          throw new PTSError(`Loop variable "${d.Name ?? d.Id}" needs a start Value (for example <FromNumber/>)`);
        }
        const m = typeof raw === "string" ? /^\s*<([^/>\s]+)\s*\/>\s*$/.exec(raw) : null;
        if (m) {
          const target = this.byId.get(m[1]);
          if (!target) throw new PTSError(`The start Value of "${d.Name ?? d.Id}" points at a missing node ${m[1]}`);
          return asScalar(evalNode(target), d.Name ?? d.Id);
        }
        return literalValue(d);
      };

      /** `for`: [variables..., condition, statements...]. Returns the list of every `Returns` value. */
      const evalFor = (n: PTSNode): Value => {
        const kids = this.kids(n.Id);
        const decls = this.loopVariables(n, inScope);
        const rest = kids.filter((c) => this.resolve(c, inScope).kind !== "cell");
        if (rest.length < 2) {
          throw new PTSError(`"for" needs a condition and at least one statement, found ${rest.length} (${this.label(n)})`);
        }
        const [cond, ...body] = rest;
        const emits = body.map((st) => {
          const k = this.resolve(st, inScope).kind;
          if (k !== "returns" && k !== "incdec") {
            throw new PTSError(`A "for" body can contain Returns and ++ / -- only, found ${k} (${this.label(st)})`);
          }
          return k === "returns";
        });

        const out: Scalar[] = [];
        const owned: string[] = []; // variables this loop started (an enclosing loop may already own others)
        try {
          for (const d of decls) {
            if (locals.has(d.Id)) continue;
            locals.set(d.Id, initialValue(d));
            owned.push(d.Id);
          }
          for (;;) {
            const c = evalNode(cond);
            if (typeof c !== "boolean") {
              throw new PTSError(`The condition of "for" must be a comparison (true/false)`, "TYPE_MISMATCH");
            }
            if (!c) break;
            if (++steps > MAX_LOOP_ITERATIONS) {
              throw new PTSError(
                `Loop stopped after ${MAX_LOOP_ITERATIONS} iterations. Does the counter change (i++)?`,
                "LOOP_LIMIT",
              );
            }
            body.forEach((st, i) => {
              const v = evalNode(st);
              if (emits[i]) out.push(asScalar(v, "Returns"));
            });
          }
        } finally {
          for (const id of owned) locals.delete(id);
        }
        return out;
      };

      const evalNode = (n: PTSNode): Value => {
        const r = this.resolve(n, inScope);

        switch (r.kind) {
          case "cell": {
            if (locals.has(n.Id)) return locals.get(n.Id)!; // loop variable
            if (n.ParentId !== scope.Id) {
              throw new PTSError(
                `Cell ${this.label(n)} is not part of the scope being evaluated (a loop variable only exists inside its for loop)`,
              );
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
                  `Formula ${this.label(n)} needs exactly 1 child expression, found ${body.length}` +
                    (body.length === 0 ? " (are its flat child nodes saved under it?)" : ""),
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
            const operands = this.kids(n.Id).map((c) => asNumber(evalNode(c), OP_SYMBOL[r.op] ?? r.op));
            if (operands.length < 2) {
              throw new PTSError(`Operator "${r.op}" needs at least 2 operands, found ${operands.length}`);
            }
            return fn(operands);
          }

          case "comparison": {
            const fn = COMPARATORS[r.op];
            if (!fn) throw new PTSError(`Comparison "${r.op}" has no implementation`);
            const sym = OP_SYMBOL[r.op] ?? r.op;
            const operands = this.kids(n.Id);
            if (operands.length !== 2) {
              throw new PTSError(`Comparison "${sym}" needs exactly 2 operands, found ${operands.length}`);
            }
            const left = asScalar(evalNode(operands[0]), sym);
            const right = asScalar(evalNode(operands[1]), sym);
            if (r.op !== "eq" && r.op !== "neq") {
              asNumber(left, sym);
              asNumber(right, sym);
            }
            return fn(left, right);
          }

          case "logical": {
            const sym = OP_SYMBOL[r.op];
            const operands = this.kids(n.Id);
            if (r.op === "not") {
              if (operands.length !== 1) {
                throw new PTSError(`"${sym}" needs exactly 1 operand, found ${operands.length}`);
              }
              return !asBoolean(evalNode(operands[0]), sym);
            }
            if (operands.length < 2) {
              throw new PTSError(`"${sym}" needs at least 2 operands, found ${operands.length}`);
            }
            for (const c of operands) {
              // short-circuit: stop as soon as the result is known
              const v = asBoolean(evalNode(c), sym);
              if (r.op === "and" && !v) return false;
              if (r.op === "or" && v) return true;
            }
            return r.op === "and";
          }

          case "literal":
            return literalValue(n);

          case "loop":
            return evalFor(n);

          case "incdec": {
            const sym = OP_SYMBOL[r.op];
            const operands = this.kids(n.Id);
            if (operands.length !== 1) {
              throw new PTSError(`"${sym}" needs exactly 1 operand, found ${operands.length}`);
            }
            const t = this.resolve(operands[0], inScope);
            const target = t.kind === "ref" ? t.target : operands[0];
            if (!locals.has(target.Id)) {
              throw new PTSError(`"${sym}" can only change a loop variable declared in a for loop (${this.label(target)})`);
            }
            const before = asNumber(locals.get(target.Id)!, sym);
            const after = r.op === "inc" ? before + 1 : before - 1;
            locals.set(target.Id, after);
            return r.prefix ? after : before;
          }

          case "returns": {
            const body = this.kids(n.Id);
            if (body.length === 1) return evalNode(body[0]);
            if (body.length > 1) {
              throw new PTSError(`"Returns" takes a Value or exactly 1 child expression, found ${body.length}`);
            }
            return literalValue(n);
          }

          case "branch":
            if (r.branch !== "if") {
              throw new PTSError(`"${branchName(r.branch)}" must follow an if (${this.label(n)})`);
            }
            return evalBranch(n, r.branch);

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
  run(scopeId: string, inputs: RowInputs): Record<string, Value> {
    const results = this.compileScope(scopeId).evalRow(inputs);
    const out: Record<string, Value> = {};
    for (const [name, r] of Object.entries(results)) {
      if (!r.ok) throw new PTSError(r.message, r.code);
      out[name] = r.value;
    }
    return out;
  }
}
