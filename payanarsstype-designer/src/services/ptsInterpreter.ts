import type { PayanarssType } from "@/types/PayanarssType";

/* ════════════════════════════════════════════════════════════════════
   PayanarssType Script interpreter

   A PTS program is a tree. Every FunctionType node keeps its logic in
   `Attributes` as an expression tree:

       Sum.Attributes = [ { Id: <+>, Attributes: [ { Id: <A> }, { Id: <B> } ] } ]

   Each `Id` points to another node, and that node's kind decides what
   happens:

       Literal            { Id: <Literal>, Value: 100 }      → constant
       keyword            if, while, for, return, =, …        → statement
       OperatorType       + - * / == AND …                    → operator
       user function      FunctionType with its own tree      → call
       built-in           SUM, IF, ROUND, LEFT …              → native code
       anything else      A, B, CreditLimit …                 → variable

   Values follow spreadsheet rules: blanks act as 0 in maths and "" in
   text, and failures are error values (#DIV/0!, #VALUE!, #NAME? …) that
   flow through the calculation instead of crashing it.
   ════════════════════════════════════════════════════════════════════ */

/* ── Values ────────────────────────────────────────────────────────── */

export type PtsErrorCode =
    | "#DIV/0!" | "#VALUE!" | "#NAME?" | "#REF!" | "#N/A" | "#NUM!"
    | "#CIRC!" | "#LOOP!" | "#ERROR!";

export class PtsError {
    constructor(public readonly code: PtsErrorCode | string, public readonly message: string) {}
    toString() { return this.code; }
}

export type PtsValue =
    | number | string | boolean | null
    | PtsError
    | PtsValue[]
    | { [key: string]: PtsValue };

export interface AstNode {
    Id?: string;
    Attributes?: unknown[];
    Value?: unknown;
    ValueTypeId?: string;
}

export const isError = (v: unknown): v is PtsError => v instanceof PtsError;
const isRecord = (v: PtsValue): v is { [key: string]: PtsValue } =>
    typeof v === "object" && v !== null && !Array.isArray(v) && !isError(v);

/* ── Control-flow signals (thrown, never shown to the user) ────────── */

class ReturnSignal { constructor(public value: PtsValue) {} }
class BreakSignal {}
class ContinueSignal {}
class ThrowSignal { constructor(public error: PtsError) {} }

/* ── Scope ─────────────────────────────────────────────────────────── */

export class Scope {
    private vars = new Map<string, PtsValue>();
    constructor(private parent?: Scope) {}

    has(id: string): boolean {
        return this.vars.has(id) || (this.parent?.has(id) ?? false);
    }
    get(id: string): PtsValue | undefined {
        if (this.vars.has(id)) return this.vars.get(id);
        return this.parent?.get(id);
    }
    /**
     * Assign to the nearest scope that owns the name. If no scope owns it yet,
     * create it at the program's top-level scope: PTS variables are declared as
     * Program nodes, so they live for the whole run (loop variables created with
     * define() stay local).
     */
    set(id: string, value: PtsValue): void {
        if (this.vars.has(id) || !this.parent) this.vars.set(id, value);
        else if (this.parent.has(id)) this.parent.set(id, value);
        else this.root().vars.set(id, value);
    }
    private root(): Scope {
        let s: Scope = this;
        while (s.parent) s = s.parent;
        return s;
    }
    define(id: string, value: PtsValue): void {
        this.vars.set(id, value);
    }
    child(): Scope {
        return new Scope(this);
    }
}

/* ── Coercion (spreadsheet semantics) ──────────────────────────────── */

export function toNumber(v: PtsValue): number | PtsError {
    if (isError(v)) return v;
    if (v === null || v === "") return 0;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string") {
        const n = Number(v.trim());
        return Number.isNaN(n) ? new PtsError("#VALUE!", `"${v}" is not a number`) : n;
    }
    return new PtsError("#VALUE!", "Expected a number");
}

export function toBool(v: PtsValue): boolean | PtsError {
    if (isError(v)) return v;
    if (typeof v === "boolean") return v;
    if (v === null || v === "") return false;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const t = v.trim().toLowerCase();
        if (t === "true") return true;
        if (t === "false") return false;
        return new PtsError("#VALUE!", `"${v}" is not TRUE or FALSE`);
    }
    return Array.isArray(v) ? v.length > 0 : true;
}

export function toText(v: PtsValue): string {
    if (v === null) return "";
    if (isError(v)) return v.code;
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v;
    return JSON.stringify(v);
}

function flatten(values: PtsValue[]): PtsValue[] {
    const out: PtsValue[] = [];
    for (const v of values) {
        if (Array.isArray(v)) out.push(...flatten(v));
        else out.push(v);
    }
    return out;
}

const firstError = (values: PtsValue[]): PtsError | undefined =>
    flatten(values).find(isError) as PtsError | undefined;

function numbersOf(values: PtsValue[]): number[] | PtsError {
    const out: number[] = [];
    for (const v of flatten(values)) {
        if (isError(v)) return v;
        if (v === null || v === "") continue;          // blanks are skipped by aggregates
        const n = toNumber(v);
        if (isError(n)) continue;                       // text is skipped, like Excel ranges
        out.push(n);
    }
    return out;
}

function equals(a: PtsValue, b: PtsValue): boolean {
    if (a === null || a === "") return b === null || b === "" || b === 0 || b === false;
    if (b === null || b === "") return a === 0 || a === false;
    if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
    if (typeof a === "number" || typeof b === "number") {
        const x = toNumber(a), y = toNumber(b);
        return !isError(x) && !isError(y) && x === y;
    }
    return JSON.stringify(a) === JSON.stringify(b);
}

function compare(a: PtsValue, b: PtsValue): number | PtsError {
    if (typeof a === "string" && typeof b === "string" && Number.isNaN(Number(a)) && Number.isNaN(Number(b))) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    }
    const x = toNumber(a);
    if (isError(x)) return x;
    const y = toNumber(b);
    if (isError(y)) return y;
    return x - y;
}

/* ── Dates (Excel serial numbers: 1 = 1900-01-01) ─────────────────── */

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const dateToSerial = (d: Date) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EXCEL_EPOCH) / DAY_MS
    + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86_400;
const serialToDate = (s: number) => new Date(EXCEL_EPOCH + s * DAY_MS);

function toSerial(v: PtsValue): number | PtsError {
    if (typeof v === "string" && Number.isNaN(Number(v))) {
        const t = Date.parse(v);
        return Number.isNaN(t) ? new PtsError("#VALUE!", `"${v}" is not a date`) : dateToSerial(new Date(t));
    }
    return toNumber(v);
}

/* ── Built-in functions ────────────────────────────────────────────── */

export interface InterpreterContext {
    currentUser?: string;
    currentTenant?: string;
    log?: (level: string, message: string) => void;
}

type Builtin = (args: PtsValue[], ctx: InterpreterContext) => PtsValue;

const num1 = (f: (x: number) => number): Builtin => ([a]) => {
    const x = toNumber(a ?? null);
    if (isError(x)) return x;
    const r = f(x);
    return Number.isFinite(r) ? r : new PtsError("#NUM!", "Result is not a finite number");
};

const roundTo = (x: number, digits: number, mode: "round" | "up" | "down") => {
    const f = Math.pow(10, digits);
    const v = x * f;
    const r = mode === "round" ? Math.round(Math.abs(v)) * Math.sign(v)
        : mode === "up" ? Math.ceil(Math.abs(v)) * Math.sign(v)
        : Math.floor(Math.abs(v)) * Math.sign(v);
    return r / f;
};

const round = (mode: "round" | "up" | "down"): Builtin => ([a, d]) => {
    const x = toNumber(a ?? null), n = toNumber(d ?? 0);
    if (isError(x)) return x;
    if (isError(n)) return n;
    return roundTo(x, Math.trunc(n), mode);
};

const aggregate = (f: (ns: number[]) => number | PtsError): Builtin => (args) => {
    const ns = numbersOf(args);
    return isError(ns) ? ns : f(ns);
};

const text1 = (f: (s: string) => PtsValue): Builtin => ([a]) => (isError(a) ? a : f(toText(a ?? null)));

const datePart = (f: (d: Date) => number): Builtin => ([a]) => {
    const s = toSerial(a ?? null);
    return isError(s) ? s : f(serialToDate(s));
};

const BUILTINS: Record<string, Builtin> = {
    /* Math */
    SUM: aggregate((ns) => ns.reduce((x, y) => x + y, 0)),
    PRODUCT: aggregate((ns) => ns.reduce((x, y) => x * y, 1)),
    ABS: num1(Math.abs),
    INT: num1(Math.floor),
    TRUNC: num1(Math.trunc),
    SQRT: (args) => { const x = toNumber(args[0] ?? null); return isError(x) ? x : x < 0 ? new PtsError("#NUM!", "Square root of a negative number") : Math.sqrt(x); },
    SIGN: num1(Math.sign),
    EXP: num1(Math.exp),
    LN: num1(Math.log),
    LOG10: num1(Math.log10),
    LOG: ([a, b]) => { const x = toNumber(a ?? null), base = toNumber(b ?? 10); if (isError(x)) return x; if (isError(base)) return base; return Math.log(x) / Math.log(base); },
    SIN: num1(Math.sin), COS: num1(Math.cos), TAN: num1(Math.tan),
    ASIN: num1(Math.asin), ACOS: num1(Math.acos), ATAN: num1(Math.atan),
    DEGREES: num1((x) => (x * 180) / Math.PI),
    RADIANS: num1((x) => (x * Math.PI) / 180),
    PI: () => Math.PI,
    RAND: () => Math.random(),
    RANDBETWEEN: ([a, b]) => { const lo = toNumber(a ?? null), hi = toNumber(b ?? null); if (isError(lo)) return lo; if (isError(hi)) return hi; return Math.floor(Math.random() * (hi - lo + 1)) + lo; },
    ROUND: round("round"), ROUNDUP: round("up"), ROUNDDOWN: round("down"),
    CEILING: ([a, s]) => { const x = toNumber(a ?? null), m = toNumber(s ?? 1); if (isError(x)) return x; if (isError(m)) return m; return m === 0 ? 0 : Math.ceil(x / m) * m; },
    FLOOR: ([a, s]) => { const x = toNumber(a ?? null), m = toNumber(s ?? 1); if (isError(x)) return x; if (isError(m)) return m; return m === 0 ? 0 : Math.floor(x / m) * m; },
    MROUND: ([a, s]) => { const x = toNumber(a ?? null), m = toNumber(s ?? 1); if (isError(x)) return x; if (isError(m)) return m; return m === 0 ? 0 : Math.round(x / m) * m; },
    EVEN: num1((x) => { const c = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -c : c; }),
    ODD: num1((x) => { let c = Math.ceil(Math.abs(x)); if (c % 2 === 0) c += 1; return x < 0 ? -c : c; }),
    MOD: ([a, b]) => { const x = toNumber(a ?? null), y = toNumber(b ?? null); if (isError(x)) return x; if (isError(y)) return y; if (y === 0) return new PtsError("#DIV/0!", "MOD by zero"); return x - y * Math.floor(x / y); },
    QUOTIENT: ([a, b]) => { const x = toNumber(a ?? null), y = toNumber(b ?? null); if (isError(x)) return x; if (isError(y)) return y; if (y === 0) return new PtsError("#DIV/0!", "Division by zero"); return Math.trunc(x / y); },
    POWER: ([a, b]) => { const x = toNumber(a ?? null), y = toNumber(b ?? null); if (isError(x)) return x; if (isError(y)) return y; return Math.pow(x, y); },

    /* Statistical */
    AVERAGE: aggregate((ns) => (ns.length ? ns.reduce((x, y) => x + y, 0) / ns.length : new PtsError("#DIV/0!", "AVERAGE of no numbers"))),
    MIN: aggregate((ns) => (ns.length ? Math.min(...ns) : 0)),
    MAX: aggregate((ns) => (ns.length ? Math.max(...ns) : 0)),
    COUNT: aggregate((ns) => ns.length),
    COUNTA: (args) => flatten(args).filter((v) => v !== null && v !== "").length,
    COUNTBLANK: (args) => flatten(args).filter((v) => v === null || v === "").length,
    MEDIAN: aggregate((ns) => {
        if (!ns.length) return new PtsError("#NUM!", "MEDIAN of no numbers");
        const s = [...ns].sort((a, b) => a - b), m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }),

    /* Text */
    CONCAT: (args) => firstError(args) ?? flatten(args).map(toText).join(""),
    CONCATENATE: (args) => firstError(args) ?? flatten(args).map(toText).join(""),
    TEXTJOIN: ([sep, ignoreEmpty, ...rest]) => {
        const err = firstError(rest); if (err) return err;
        const skip = toBool(ignoreEmpty ?? true);
        const parts = flatten(rest).map(toText).filter((s) => !(skip === true && s === ""));
        return parts.join(toText(sep ?? ""));
    },
    LEN: text1((s) => s.length),
    TRIM: text1((s) => s.trim().replace(/\s+/g, " ")),
    UPPER: text1((s) => s.toUpperCase()),
    LOWER: text1((s) => s.toLowerCase()),
    PROPER: text1((s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())),
    LEFT: ([a, n]) => { if (isError(a)) return a; const k = toNumber(n ?? 1); return isError(k) ? k : toText(a ?? null).slice(0, k); },
    RIGHT: ([a, n]) => { if (isError(a)) return a; const k = toNumber(n ?? 1); return isError(k) ? k : k <= 0 ? "" : toText(a ?? null).slice(-k); },
    MID: ([a, start, n]) => { if (isError(a)) return a; const s = toNumber(start ?? 1), k = toNumber(n ?? 0); if (isError(s)) return s; if (isError(k)) return k; return toText(a ?? null).substr(s - 1, k); },
    FIND: ([needle, hay, start]) => { const s = toNumber(start ?? 1); if (isError(s)) return s; const i = toText(hay ?? null).indexOf(toText(needle ?? null), s - 1); return i < 0 ? new PtsError("#VALUE!", "Text not found") : i + 1; },
    SEARCH: ([needle, hay, start]) => { const s = toNumber(start ?? 1); if (isError(s)) return s; const i = toText(hay ?? null).toLowerCase().indexOf(toText(needle ?? null).toLowerCase(), s - 1); return i < 0 ? new PtsError("#VALUE!", "Text not found") : i + 1; },
    SUBSTITUTE: ([t, oldT, newT]) => toText(t ?? null).split(toText(oldT ?? null)).join(toText(newT ?? null)),
    REPT: ([t, n]) => { const k = toNumber(n ?? 0); return isError(k) ? k : toText(t ?? null).repeat(Math.max(0, k)); },
    EXACT: ([a, b]) => toText(a ?? null) === toText(b ?? null),
    VALUE: ([a]) => toNumber(a ?? null),
    TEXT: ([a, fmt]) => {
        const x = toNumber(a ?? null); if (isError(x)) return x;
        const f = toText(fmt ?? "");
        const decimals = (f.split(".")[1] ?? "").replace(/[^0#]/g, "").length;
        return x.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: f.includes(",") });
    },
    CHAR: ([a]) => { const x = toNumber(a ?? null); return isError(x) ? x : String.fromCharCode(x); },
    CODE: ([a]) => { const s = toText(a ?? null); return s ? s.charCodeAt(0) : new PtsError("#VALUE!", "Empty text"); },

    /* Date & time */
    TODAY: () => Math.floor(dateToSerial(new Date())),
    NOW: () => dateToSerial(new Date()),
    DATE: ([y, m, d]) => { const Y = toNumber(y ?? null), M = toNumber(m ?? null), D = toNumber(d ?? null); if (isError(Y)) return Y; if (isError(M)) return M; if (isError(D)) return D; return (Date.UTC(Y, M - 1, D) - EXCEL_EPOCH) / DAY_MS; },
    YEAR: datePart((d) => d.getUTCFullYear()),
    MONTH: datePart((d) => d.getUTCMonth() + 1),
    DAY: datePart((d) => d.getUTCDate()),
    WEEKDAY: datePart((d) => d.getUTCDay() + 1),
    DAYS: ([end, start]) => { const e = toSerial(end ?? null), s = toSerial(start ?? null); if (isError(e)) return e; if (isError(s)) return s; return Math.trunc(e) - Math.trunc(s); },
    EDATE: ([start, months]) => { const s = toSerial(start ?? null), m = toNumber(months ?? 0); if (isError(s)) return s; if (isError(m)) return m; const d = serialToDate(s); d.setUTCMonth(d.getUTCMonth() + m); return (d.getTime() - EXCEL_EPOCH) / DAY_MS; },

    /* Logical / information (eager forms; IF, AND, OR, IFERROR are lazy below) */
    NOT: ([a]) => { const b = toBool(a ?? null); return isError(b) ? b : !b; },
    TRUE: () => true,
    FALSE: () => false,
    ISNUMBER: ([a]) => typeof a === "number",
    ISTEXT: ([a]) => typeof a === "string" && a !== "",
    ISBLANK: ([a]) => a === null || a === "" || a === undefined,
    ISERROR: ([a]) => isError(a),
    ISNA: ([a]) => isError(a) && a.code === "#N/A",
    ISLOGICAL: ([a]) => typeof a === "boolean",
    ISEVEN: ([a]) => { const x = toNumber(a ?? null); return isError(x) ? x : Math.trunc(x) % 2 === 0; },
    ISODD: ([a]) => { const x = toNumber(a ?? null); return isError(x) ? x : Math.abs(Math.trunc(x) % 2) === 1; },
    NA: () => new PtsError("#N/A", "Value not available"),
    N: ([a]) => (typeof a === "number" ? a : typeof a === "boolean" ? (a ? 1 : 0) : 0),
    CHOOSE: ([idx, ...opts]) => { const i = toNumber(idx ?? null); if (isError(i)) return i; return opts[Math.trunc(i) - 1] ?? new PtsError("#VALUE!", "CHOOSE index out of range"); },

    /* Financial (most-used) */
    PMT: ([rate, nper, pv, fv, type]) => {
        const r = toNumber(rate ?? null), n = toNumber(nper ?? null), p = toNumber(pv ?? null), f = toNumber(fv ?? 0), t = toNumber(type ?? 0);
        for (const v of [r, n, p, f, t]) if (isError(v)) return v;
        const [R, N, P, F, T] = [r, n, p, f, t] as number[];
        if (R === 0) return -(P + F) / N;
        const k = Math.pow(1 + R, N);
        return -(R * (P * k + F)) / ((1 + R * T) * (k - 1));
    },
    SLN: ([cost, salvage, life]) => { const c = toNumber(cost ?? null), s = toNumber(salvage ?? null), l = toNumber(life ?? null); if (isError(c)) return c; if (isError(s)) return s; if (isError(l)) return l; return l === 0 ? new PtsError("#DIV/0!", "Life is zero") : (c - s) / l; },

    /* Collections (PTS CollectionFunction) */
    APPEND: ([list, v]) => [...(Array.isArray(list) ? list : []), v ?? null],
    REMOVE: ([coll, key]) => Array.isArray(coll) ? coll.filter((x) => !equals(x, key ?? null))
        : isRecord(coll ?? null) ? Object.fromEntries(Object.entries(coll as Record<string, PtsValue>).filter(([k]) => k !== toText(key ?? null))) : new PtsError("#VALUE!", "REMOVE needs a List or Map"),
    CONTAINS: ([coll, v]) => Array.isArray(coll) ? coll.some((x) => equals(x, v ?? null))
        : isRecord(coll ?? null) ? toText(v ?? null) in (coll as Record<string, PtsValue>) : toText(coll ?? null).includes(toText(v ?? null)),
    SIZE: ([coll]) => Array.isArray(coll) ? coll.length : isRecord(coll ?? null) ? Object.keys(coll as object).length : toText(coll ?? null).length,
    GET: ([coll, key]) => Array.isArray(coll) ? (() => { const i = toNumber(key ?? null); return isError(i) ? i : coll[i] ?? null; })()
        : isRecord(coll ?? null) ? (coll as Record<string, PtsValue>)[toText(key ?? null)] ?? null : new PtsError("#VALUE!", "GET needs a List or Map"),
    KEYS: ([coll]) => (isRecord(coll ?? null) ? Object.keys(coll as object) : new PtsError("#VALUE!", "KEYS needs a Map")),
    FIRST: ([list]) => (Array.isArray(list) ? list[0] ?? null : null),
    LAST: ([list]) => (Array.isArray(list) ? list[list.length - 1] ?? null : null),
    ISEMPTY: ([coll]) => Array.isArray(coll) ? coll.length === 0 : isRecord(coll ?? null) ? Object.keys(coll as object).length === 0 : coll === null || coll === "",

    /* System (PTS SystemFunction) */
    CURRENTUSER: (_a, ctx) => ctx.currentUser ?? null,
    CURRENTTENANT: (_a, ctx) => ctx.currentTenant ?? null,
    NEWID: () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    LOG_MESSAGE: ([level, message], ctx) => { ctx.log?.(toText(level ?? "INFO"), toText(message ?? null)); return null; },
};

/** Names that need their arguments evaluated lazily (short-circuit). */
const LAZY_BUILTINS = new Set(["IF", "IFS", "AND", "OR", "IFERROR", "IFNA", "SWITCH"]);

/** Built-ins that need a live runtime (agents, database, notifications). */
const RUNTIME_ONLY = new Set(["ASKAGENT", "NOTIFY", "NEXTSEQUENCE", "VLOOKUP", "HLOOKUP", "XLOOKUP", "INDEX", "MATCH", "SUMIF", "SUMIFS", "COUNTIF", "COUNTIFS"]);

export const supportedBuiltins = (): string[] => [...Object.keys(BUILTINS), ...LAZY_BUILTINS].sort();

/* ── Interpreter ───────────────────────────────────────────────────── */

const STATEMENT_KEYWORDS = new Set([
    "if", "else", "else if", "switch", "case", "default", "while", "do", "for", "foreach", "in",
    "break", "continue", "return", "throw", "try", "catch", "finally", "Exception", "block",
    "await", "this", "null", "Literal",
]);
const MARKER_NAMES = new Set(["param", "out", "import", "ReadOnly", "Mandatory", "IsUniqueId"]);

export interface InterpreterOptions {
    nodes: Map<string, PayanarssType>;
    context?: InterpreterContext;
    /** Maximum evaluation steps per call; protects against infinite loops. */
    maxSteps?: number;
}

export class PtsInterpreter {
    private nodes: Map<string, PayanarssType>;
    private ctx: InterpreterContext;
    private maxSteps: number;
    private steps = 0;
    private callStack = new Set<string>();
    private memo = new Map<string, PtsValue>();

    constructor(opts: InterpreterOptions) {
        this.nodes = opts.nodes;
        this.ctx = opts.context ?? {};
        this.maxSteps = opts.maxSteps ?? 100_000;
    }

    /** Evaluate a FunctionType node against a scope (e.g. one table row). */
    run(fn: PayanarssType, scope: Scope, record?: Record<string, PtsValue>): PtsValue {
        this.steps = 0;
        this.memo.clear();
        this.callStack.clear();
        this.record = record ?? {};
        try {
            return this.callFunction(fn, [], scope);
        } catch (e) {
            if (e instanceof ThrowSignal) return e.error;
            if (e instanceof PtsError) return e;
            return new PtsError("#ERROR!", e instanceof Error ? e.message : String(e));
        }
    }

    private record: Record<string, PtsValue> = {};

    /* ── helpers ── */

    private typeNameOf(node: PayanarssType): string {
        return this.nodes.get(node.PayanarssTypeId)?.Name ?? "";
    }

    private normalize(raw: unknown): AstNode | null {
        if (typeof raw === "string") return { Id: raw };
        if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as AstNode;
        return null; // numbers / nulls in Attributes (e.g. the 1e+32 artefact) are ignored
    }

    private argsOf(expr: AstNode): AstNode[] {
        return (expr.Attributes ?? []).map((a) => this.normalize(a)).filter((a): a is AstNode => a !== null);
    }

    private hasBody(node: PayanarssType): boolean {
        return (node.Attributes ?? []).some((a) => a && typeof a === "object" && "Id" in (a as object));
    }

    private isMarker(node: PayanarssType): boolean {
        return MARKER_NAMES.has(node.Name) || this.typeNameOf(node) === "EventType" || /^On[A-Z]/.test(node.Name);
    }

    private isUserFunction(node: PayanarssType): boolean {
        const typeName = this.typeNameOf(node);
        return (typeName === "FunctionType" || typeName.endsWith("Function") || typeName === "Program") && this.hasBody(node);
    }

    private tick() {
        if (++this.steps > this.maxSteps) throw new PtsError("#LOOP!", `Stopped after ${this.maxSteps} steps; check for an endless loop`);
    }

    /* ── function call ── */

    private callFunction(fn: PayanarssType, args: AstNode[], scope: Scope): PtsValue {
        if (this.callStack.has(fn.Id)) return new PtsError("#CIRC!", `"${fn.Name}" refers to itself`);
        if (args.length === 0 && this.memo.has(fn.Id)) return this.memo.get(fn.Id)!;

        let local = scope;
        if (args.length > 0) {
            // Parameters: children of the function flagged with `param`, bound in order
            const params = [...this.nodes.values()].filter(
                (n) => n.ParentId === fn.Id && n.Id !== fn.Id && (n.Attributes ?? []).some((a) => {
                    const ref = this.normalize(a);
                    return !!ref?.Id && this.nodes.get(ref.Id)?.Name === "param";
                })
            );
            local = scope.child();
            params.forEach((p, i) => local.define(p.Id, args[i] ? this.evaluate(args[i], scope) : null));
        }

        this.callStack.add(fn.Id);
        let result: PtsValue = null;
        try {
            for (const stmt of this.argsOf({ Attributes: fn.Attributes })) {
                const target = stmt.Id ? this.nodes.get(stmt.Id) : undefined;
                if (target && !stmt.Attributes?.length && !("Value" in stmt) && this.isMarker(target)) continue;
                result = this.evaluate(stmt, local);
            }
        } catch (e) {
            if (e instanceof ReturnSignal) result = e.value;
            else throw e;
        } finally {
            this.callStack.delete(fn.Id);
        }

        if (args.length === 0) this.memo.set(fn.Id, result);
        return result;
    }

    /* ── expression / statement evaluation ── */

    evaluate(expr: AstNode, scope: Scope): PtsValue {
        this.tick();

        // 1. Literal constant
        if ("Value" in expr) return (expr.Value ?? null) as PtsValue;

        const id = expr.Id;
        if (!id) return new PtsError("#REF!", "Expression node has no Id");
        const node = this.nodes.get(id);
        if (!node) return new PtsError("#REF!", `Node ${id} does not exist`);

        const args = this.argsOf(expr);

        // 2. Statement keywords (self-typed nodes such as if / while / return)
        if (STATEMENT_KEYWORDS.has(node.Name) && node.PayanarssTypeId === node.Id) {
            return this.statement(node.Name, args, scope);
        }

        // 3. Operators
        if (this.typeNameOf(node) === "OperatorType") return this.operator(node.Name, args, scope);

        // 4. Variable already holding a value in scope (row cell, assigned variable)
        if (scope.has(id) && args.length === 0) return scope.get(id) ?? null;

        // 5. User-defined function (FunctionType with its own tree)
        if (this.isUserFunction(node)) return this.callFunction(node, args, scope);

        // 6. Built-in function
        const fname = node.Name.toUpperCase();
        const category = this.nodes.get(node.ParentId)?.Name;
        if (fname === "LOG" && category === "SystemFunction") {
            return BUILTINS.LOG_MESSAGE(args.map((a) => this.evaluate(a, scope)), this.ctx);
        }
        if (LAZY_BUILTINS.has(fname)) return this.lazyBuiltin(fname, args, scope);
        if (BUILTINS[fname]) {
            const values = args.map((a) => this.evaluate(a, scope));
            return BUILTINS[fname](values, this.ctx);
        }
        if (RUNTIME_ONLY.has(fname)) return new PtsError("#N/A", `${fname} needs the live MAA ERP runtime`);

        // 7. Unset variable → blank cell
        if (args.length === 0) return null;

        return new PtsError("#NAME?", `"${node.Name}" is not a function the interpreter knows`);
    }

    private lazyBuiltin(name: string, args: AstNode[], scope: Scope): PtsValue {
        const ev = (i: number): PtsValue => (args[i] ? this.evaluate(args[i], scope) : null);
        switch (name) {
            case "IF": {
                if (args.length < 2) return new PtsError("#VALUE!", "IF needs a condition and a value");
                const c = toBool(ev(0));
                if (isError(c)) return c;
                return c ? ev(1) : args.length > 2 ? ev(2) : false;
            }
            case "IFS": {
                for (let i = 0; i + 1 < args.length; i += 2) {
                    const c = toBool(ev(i));
                    if (isError(c)) return c;
                    if (c) return ev(i + 1);
                }
                return new PtsError("#N/A", "No IFS condition was TRUE");
            }
            case "AND": {
                for (let i = 0; i < args.length; i++) { const b = toBool(ev(i)); if (isError(b)) return b; if (!b) return false; }
                return true;
            }
            case "OR": {
                for (let i = 0; i < args.length; i++) { const b = toBool(ev(i)); if (isError(b)) return b; if (b) return true; }
                return false;
            }
            case "IFERROR": { const v = ev(0); return isError(v) ? ev(1) : v; }
            case "IFNA": { const v = ev(0); return isError(v) && v.code === "#N/A" ? ev(1) : v; }
            case "SWITCH": {
                const v = ev(0);
                for (let i = 1; i + 1 < args.length; i += 2) if (equals(v, ev(i))) return ev(i + 1);
                return args.length % 2 === 0 ? ev(args.length - 1) : new PtsError("#N/A", "No SWITCH case matched");
            }
        }
        return new PtsError("#NAME?", name);
    }

    /* ── operators ── */

    private operator(op: string, args: AstNode[], scope: Scope): PtsValue {
        const ev = (i: number): PtsValue => (args[i] ? this.evaluate(args[i], scope) : null);

        // Short-circuit and assignment operators first
        switch (op) {
            case "AND": case "&&": {
                const a = toBool(ev(0)); if (isError(a)) return a; if (!a) return false;
                return toBool(ev(1));
            }
            case "OR": case "||": {
                const a = toBool(ev(0)); if (isError(a)) return a; if (a) return true;
                return toBool(ev(1));
            }
            case "NOT": case "!": { const a = toBool(ev(0)); return isError(a) ? a : !a; }
            case "??": { const a = ev(0); return a === null || a === "" ? ev(1) : a; }
            case "?:": { const c = toBool(ev(0)); if (isError(c)) return c; return c ? ev(1) : ev(2); }
            case "=": return this.assign(args, scope, (_old, v) => v);
            case "+=": return this.assign(args, scope, (o, v) => this.arith("+", o, v));
            case "-=": return this.assign(args, scope, (o, v) => this.arith("-", o, v));
            case "*=": return this.assign(args, scope, (o, v) => this.arith("*", o, v));
            case "/=": return this.assign(args, scope, (o, v) => this.arith("/", o, v));
            case "%=": return this.assign(args, scope, (o, v) => this.arith("%", o, v));
            case "++": return this.assign(args.slice(0, 1), scope, (o) => this.arith("+", o, 1), true);
            case "--": return this.assign(args.slice(0, 1), scope, (o) => this.arith("-", o, 1), true);
            case ".": case "?.": {
                const obj = ev(0);
                if (op === "?." && (obj === null || obj === "")) return null;
                const key = args[1] && "Value" in args[1] ? toText(args[1].Value as PtsValue) : toText(ev(1));
                if (isRecord(obj)) return obj[key] ?? null;
                return new PtsError("#VALUE!", `Cannot read "${key}" of a non-record value`);
            }
            case "[]": {
                const coll = ev(0), key = ev(1);
                if (Array.isArray(coll)) { const i = toNumber(key); return isError(i) ? i : coll[i] ?? null; }
                if (isRecord(coll)) return coll[toText(key)] ?? null;
                return new PtsError("#VALUE!", "[] needs a List or Map");
            }
        }

        const a = ev(0);
        const b = ev(1);
        if (isError(a)) return a;
        if (isError(b)) return b;

        switch (op) {
            case "+": case "-": case "*": case "/": case "%": case "^":
                return args.length === 1 && op === "-" ? this.arith("-", 0, a) : this.arith(op, a, b);
            case "&": return toText(a) + toText(b);
            case "==": return equals(a, b);
            case "!=": return !equals(a, b);
            case ">": case "<": case ">=": case "<=": {
                const c = compare(a, b);
                if (isError(c)) return c;
                return op === ">" ? c > 0 : op === "<" ? c < 0 : op === ">=" ? c >= 0 : c <= 0;
            }
            case "is": {
                const t = args[1]?.Id ? this.nodes.get(args[1].Id)?.Name.toLowerCase() : "";
                if (t === "number") return typeof a === "number";
                if (t === "text") return typeof a === "string";
                if (t === "boolean") return typeof a === "boolean";
                if (t === "list") return Array.isArray(a);
                if (t === "map") return isRecord(a);
                return a !== null;
            }
            case "as": {
                const t = args[1]?.Id ? this.nodes.get(args[1].Id)?.Name.toLowerCase() : "";
                if (t === "number") { const n = toNumber(a); return isError(n) ? null : n; }
                if (t === "text") return toText(a);
                if (t === "boolean") { const x = toBool(a); return isError(x) ? null : x; }
                return a;
            }
        }
        return new PtsError("#NAME?", `Unknown operator "${op}"`);
    }

    private arith(op: string, a: PtsValue, b: PtsValue): PtsValue {
        const x = toNumber(a);
        if (isError(x)) return x;
        const y = toNumber(b);
        if (isError(y)) return y;
        switch (op) {
            case "+": return x + y;
            case "-": return x - y;
            case "*": return x * y;
            case "/": return y === 0 ? new PtsError("#DIV/0!", "Division by zero") : x / y;
            case "%": return y === 0 ? new PtsError("#DIV/0!", "Modulo by zero") : x - y * Math.floor(x / y);
            case "^": return Math.pow(x, y);
        }
        return new PtsError("#NAME?", `Unknown operator "${op}"`);
    }

    private assign(args: AstNode[], scope: Scope, f: (old: PtsValue, value: PtsValue) => PtsValue, returnOld = false): PtsValue {
        const target = args[0];
        if (!target?.Id) return new PtsError("#REF!", "Assignment needs a variable on the left");
        const old = scope.has(target.Id) ? scope.get(target.Id) ?? null : null;
        const value = args[1] ? this.evaluate(args[1], scope) : null;
        const next = f(old, value);
        scope.set(target.Id, next);
        return returnOld ? old : next;
    }

    /* ── statements ── */

    private statement(keyword: string, args: AstNode[], scope: Scope): PtsValue {
        const ev = (i: number, s: Scope = scope): PtsValue => (args[i] ? this.evaluate(args[i], s) : null);
        const truthy = (i: number, s: Scope = scope): boolean => {
            const b = toBool(ev(i, s));
            if (isError(b)) throw new ThrowSignal(b);
            return b;
        };

        switch (keyword) {
            case "Literal": return null;
            case "null": return null;
            case "this": return this.record;

            case "block": {
                let last: PtsValue = null;
                for (let i = 0; i < args.length; i++) last = ev(i);
                return last;
            }

            case "if": case "else if": {
                if (truthy(0)) return ev(1, scope.child());
                return args[2] ? ev(2) : null;
            }
            case "else": return args[0] ? ev(0, scope.child()) : null;

            case "while": {
                let last: PtsValue = null;
                while (truthy(0)) {
                    try { last = ev(1, scope.child()); }
                    catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
                }
                return last;
            }
            case "do": {
                let last: PtsValue = null;
                do {
                    try { last = ev(0, scope.child()); }
                    catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
                } while (truthy(1));
                return last;
            }
            case "for": {
                // for → [init, condition, step, body]
                const loop = scope.child();
                let last: PtsValue = null;
                if (args[0]) this.evaluate(args[0], loop);
                while (args[1] ? truthy(1, loop) : true) {
                    try { last = ev(3, loop.child()); }
                    catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
                    if (args[2]) this.evaluate(args[2], loop);
                }
                return last;
            }
            case "foreach": {
                // foreach → [loopVariable, in → [collection], body]
                const varId = args[0]?.Id;
                const inNode = args[1];
                const source = inNode ? this.argsOf(inNode)[0] : undefined;
                const coll = source ? this.evaluate(source, scope) : null;
                const items = Array.isArray(coll) ? coll : isRecord(coll) ? Object.keys(coll) : [];
                let last: PtsValue = null;
                for (const item of items) {
                    const iter = scope.child();
                    if (varId) iter.define(varId, item);
                    try { last = ev(2, iter); }
                    catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
                }
                return last;
            }
            case "in": return ev(0);

            case "switch": {
                // switch → [value, case → [match, block]…, default → [block]]
                const v = ev(0);
                let matched = false;
                for (const branch of args.slice(1)) {
                    const bNode = branch.Id ? this.nodes.get(branch.Id) : undefined;
                    const parts = this.argsOf(branch);
                    try {
                        if (bNode?.Name === "case" && (matched || equals(v, this.evaluate(parts[0], scope)))) {
                            matched = true;
                            if (parts[1]) this.evaluate(parts[1], scope.child());
                        } else if (bNode?.Name === "default") {
                            matched = true;
                            if (parts[0]) this.evaluate(parts[0], scope.child());
                        }
                    } catch (e) {
                        if (e instanceof BreakSignal) break;
                        throw e;
                    }
                }
                return null;
            }
            case "case": case "default": return null;

            case "break": throw new BreakSignal();
            case "continue": throw new ContinueSignal();
            case "return": throw new ReturnSignal(ev(0));

            case "Exception": {
                // A bare `Exception` inside catch refers to the error being handled (rethrow)
                if (args.length === 0 && scope.has("__error__")) return scope.get("__error__") ?? null;
                const code = args[0] ? toText(ev(0)) : "#ERROR!";
                const message = args[1] ? toText(ev(1)) : code;
                return new PtsError(code, message);
            }
            case "throw": {
                const v = args[0] ? ev(0) : new PtsError("#ERROR!", "Error raised");
                throw new ThrowSignal(isError(v) ? v : new PtsError("#ERROR!", toText(v)));
            }
            case "try": {
                // try → [block, catch → [block], finally → [block]]
                const catchNode = args.find((a) => a.Id && this.nodes.get(a.Id)?.Name === "catch");
                const finallyNode = args.find((a) => a.Id && this.nodes.get(a.Id)?.Name === "finally");
                let result: PtsValue = null;
                try {
                    result = ev(0, scope.child());
                } catch (e) {
                    if (!(e instanceof ThrowSignal) || !catchNode) throw e;
                    const handlerScope = scope.child();
                    handlerScope.define("__error__", e.error);
                    const body = this.argsOf(catchNode)[0];
                    result = body ? this.evaluate(body, handlerScope) : null;
                } finally {
                    const body = finallyNode ? this.argsOf(finallyNode)[0] : undefined;
                    if (body) this.evaluate(body, scope.child());
                }
                return result;
            }
            case "catch": case "finally": return null;

            case "await": return ev(0);
        }
        return new PtsError("#NAME?", `Keyword "${keyword}" is not supported`);
    }
}

/* ── Formula display: turns a function's tree into readable text ───── */

const INFIX = new Set(["+", "-", "*", "/", "%", "^", "==", "!=", ">", "<", ">=", "<=", "AND", "OR", "&", "??", "=", "+=", "-=", "*=", "/=", "%=", "is", "as"]);

export function formatFormula(fn: PayanarssType, nodes: Map<string, PayanarssType>): string {
    const fmt = (raw: unknown): string => {
        const e: AstNode | null = typeof raw === "string" ? { Id: raw } : raw && typeof raw === "object" ? (raw as AstNode) : null;
        if (!e) return "";
        if ("Value" in e) return typeof e.Value === "string" ? `"${e.Value}"` : String(e.Value);
        const node = e.Id ? nodes.get(e.Id) : undefined;
        if (!node) return "#REF!";
        const parts = (e.Attributes ?? []).map(fmt).filter((s) => s !== "");
        const name = node.Name;
        if (parts.length === 0) return name;
        if (INFIX.has(name) && parts.length === 2) return `(${parts[0]} ${name} ${parts[1]})`;
        if (name === "NOT" && parts.length === 1) return `NOT ${parts[0]}`;
        if (name === "?:" && parts.length === 3) return `(${parts[0]} ? ${parts[1]} : ${parts[2]})`;
        if (name === "." && parts.length === 2) return `${parts[0]}.${parts[1].replace(/"/g, "")}`;
        if (name === "block") return `{ ${parts.join("; ")} }`;
        return `${name}(${parts.join(", ")})`;
    };
    const body = (fn.Attributes ?? [])
        .filter((a) => {
            const e: AstNode | null = typeof a === "string" ? { Id: a } : a && typeof a === "object" ? (a as AstNode) : null;
            const n = e?.Id ? nodes.get(e.Id) : undefined;
            return !(n && !e?.Attributes?.length && (MARKER_NAMES.has(n.Name) || /^On[A-Z]/.test(n.Name)));
        })
        .map(fmt)
        .filter((s) => s !== "")
        .map((s) => (s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : s));
    return body.length ? `= ${body.join("; ")}` : "= (empty)";
}
