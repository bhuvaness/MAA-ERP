/**
 * Core PayanarssType interface — the universal building block.
 * Every entity in MAA ERP (industry, module, table, column, rule)
 * is represented as a PayanarssType node in a flat array.
 *
 * Hierarchy is encoded via Id/ParentId:
 *   - Root nodes: Id === ParentId (self-referencing)
 *   - Children:   ParentId === parent's Id, Id !== ParentId
 */
export interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string; // What KIND of node (GroupType, TableType, etc.)
  Attributes: any[];
  Description: string | null;
}

/**
 * Tree node — PayanarssType enriched with resolved children.
 * Used only for in-memory navigation; never persisted.
 */
export interface PayanarssTypeNode extends PayanarssType {
  children: PayanarssTypeNode[];
  level: number;
  childCount: number; // Total descendants (not just direct children)
}

/**
 * Well-known PayanarssTypeId values.
 * These classify what role each node plays in the hierarchy.
 *
 * Hierarchy pattern:
 *   GroupType → ModuleType → SubModuleType → BusinessUseCase → TableType → ValueType/LookupType
 *                                                                       → RuleType
 */
export const TYPE_IDS = {
  GROUP_TYPE: "100000000000000000000000000000004",
  MODULE_TYPE: "100000000000000000000000000000005",
  SUB_MODULE_TYPE: "100000000000000000000000000000006",
  BUSINESS_USE_CASE: "10000000000000000000000000000000111",
  TABLE_TYPE: "100000000000000000000000000000002",
  CHILD_TABLE_TYPE: "100000000000000000000000000000007",
  VALUE_TYPE: "100000000000000000000000000000001",
  LOOKUP_TYPE: "100000000000000000000000000000003",
  RULE_TYPE: "100000000000000000000000000000008",
} as const;

/**
 * Human-readable labels for each type.
 * Used in UI breadcrumbs and descriptions.
 */
export const TYPE_LABELS: Record<string, string> = {
  [TYPE_IDS.GROUP_TYPE]: "Category",
  [TYPE_IDS.MODULE_TYPE]: "Module",
  [TYPE_IDS.SUB_MODULE_TYPE]: "Sub-Module",
  [TYPE_IDS.BUSINESS_USE_CASE]: "Use Case",
  [TYPE_IDS.TABLE_TYPE]: "Table",
  [TYPE_IDS.CHILD_TABLE_TYPE]: "Child Table",
  [TYPE_IDS.VALUE_TYPE]: "Field",
  [TYPE_IDS.LOOKUP_TYPE]: "Lookup",
  [TYPE_IDS.RULE_TYPE]: "Rule",
};

/**
 * Icons for each hierarchy level (used in drill-down UI).
 * Maps PayanarssTypeId → emoji for quick visual scanning.
 */
export const TYPE_ICONS: Record<string, string> = {
  [TYPE_IDS.GROUP_TYPE]: "🏢",
  [TYPE_IDS.MODULE_TYPE]: "📦",
  [TYPE_IDS.SUB_MODULE_TYPE]: "📂",
  [TYPE_IDS.BUSINESS_USE_CASE]: "⚡",
  [TYPE_IDS.TABLE_TYPE]: "🗃️",
  [TYPE_IDS.CHILD_TABLE_TYPE]: "📋",
  [TYPE_IDS.VALUE_TYPE]: "📄",
  [TYPE_IDS.LOOKUP_TYPE]: "🔗",
  [TYPE_IDS.RULE_TYPE]: "📏",
};
