/**
 * Sample data for the "Arithmetic Operators" table.
 * - Sum is your original hierarchy, verbatim.
 * - Difference / Product / Quotient follow the same pattern, built with a helper.
 *
 * The TODO_* type IDs are PLACEHOLDERS: replace them with the real IDs of your
 * Subtract / Multiply / Divide operator nodes and the LogicalFunction type.
 */
import { TYPE_ID, TypeRegistry } from "./pts-interpreter";
import type { PTSNode } from "./pts-interpreter";
import type { Row } from "./TableView";

export const ARITHMETIC_SCOPE_ID = "muthndo4rn8bjv08bf";
const A_ID = "mutho0r4pryucm9p7d";
const B_ID = "muthoizmwi7deirw52q";

const OP_SUB = "TODO_SUBTRACT_OPERATOR_ID";
const OP_MUL = "TODO_MULTIPLY_OPERATOR_ID";
const OP_DIV = "TODO_DIVIDE_OPERATOR_ID";
const TYPE_LOGICAL_FUNCTION = "TODO_LOGICAL_FUNCTION_ID";

/** formula column -> operator -> (ref A, ref B), all in one go. */
function binaryFormula(id: string, name: string, formulaTypeId: string, opTypeId: string): PTSNode[] {
  return [
    { Id: id, ParentId: ARITHMETIC_SCOPE_ID, Name: name, PayanarssTypeId: formulaTypeId, Attributes: [], Description: null },
    { Id: `${id}-op`, ParentId: id, PayanarssTypeId: opTypeId, Attributes: [], Description: null },
    { Id: `${id}-a`, ParentId: `${id}-op`, PayanarssTypeId: A_ID, Attributes: [], Description: null },
    { Id: `${id}-b`, ParentId: `${id}-op`, PayanarssTypeId: B_ID, Attributes: [], Description: null },
  ];
}

export const arithmeticNodes: PTSNode[] = [
  {
    Id: ARITHMETIC_SCOPE_ID,
    ParentId: "muthm0y1wa57ghlxlmc",
    Name: "Arithmetic Operators (+, -, *, /, %)",
    PayanarssTypeId: TYPE_ID.SCOPE,
    Attributes: [], Description: null, requiredFlags: [], alwaysOn: true,
  },
  {
    Id: A_ID, ParentId: ARITHMETIC_SCOPE_ID, Name: "A", PayanarssTypeId: TYPE_ID.CELL,
    Attributes: [], Description: null, requiredFlags: [], alwaysOn: true,
  },
  {
    Id: B_ID, ParentId: ARITHMETIC_SCOPE_ID, Name: "B", PayanarssTypeId: TYPE_ID.CELL,
    Attributes: [], Description: null, requiredFlags: [], alwaysOn: true,
  },

  // Sum: your original nodes, unchanged
  { Id: "muthoynsqpkbxh9p0at", ParentId: ARITHMETIC_SCOPE_ID, Name: "Sum", PayanarssTypeId: TYPE_ID.FORMULA, Attributes: [], Description: null },
  { Id: "muthoynsqpkbxh9p10at", ParentId: "muthoynsqpkbxh9p0at", PayanarssTypeId: TYPE_ID.ADD, Attributes: [], Description: null },
  { Id: "muthoynsqpkbxh9p20at", ParentId: "muthoynsqpkbxh9p10at", PayanarssTypeId: A_ID, Attributes: [], Description: null },
  { Id: "muthoynsqpkbxh9p30at", ParentId: "muthoynsqpkbxh9p10at", PayanarssTypeId: B_ID, Attributes: [], Description: null },

  ...binaryFormula("pts-difference", "Difference", TYPE_ID.FORMULA, OP_SUB),
  ...binaryFormula("pts-product", "Product", TYPE_ID.FORMULA, OP_MUL),
  // The screenshot types Quotient as "LogicalFunction"; kept as-is, see registry below.
  ...binaryFormula("pts-quotient", "Quotient", TYPE_LOGICAL_FUNCTION, OP_DIV),
];

export function arithmeticRegistry(): TypeRegistry {
  return TypeRegistry.default()
    .registerOperator(OP_SUB, "sub")
    .registerOperator(OP_MUL, "mul")
    .registerOperator(OP_DIV, "div")
    .register(TYPE_LOGICAL_FUNCTION, { kind: "formula" }, "LogicalFunction");
}

/** The five rows visible in your screenshot. */
export const arithmeticDemoRows: Row[] = [
  { A: "10", B: "20" },
  { A: "11", B: "21" },
  { A: "12", B: "22" },
  { A: "13", B: "23" },
  { A: "14", B: "24" },
];
