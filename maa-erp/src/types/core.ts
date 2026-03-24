export interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: unknown[];
  Description: string | null;
}

export interface PayanarssTypeNode extends PayanarssType {
  children: PayanarssTypeNode[];
  level: number;
  childCount: number;
}

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

export const TYPE_ICONS: Record<string, string> = {
  [TYPE_IDS.GROUP_TYPE]: "office",
  [TYPE_IDS.MODULE_TYPE]: "package",
  [TYPE_IDS.SUB_MODULE_TYPE]: "folder",
  [TYPE_IDS.BUSINESS_USE_CASE]: "bolt",
  [TYPE_IDS.TABLE_TYPE]: "table",
  [TYPE_IDS.CHILD_TABLE_TYPE]: "list",
  [TYPE_IDS.VALUE_TYPE]: "file",
  [TYPE_IDS.LOOKUP_TYPE]: "link",
  [TYPE_IDS.RULE_TYPE]: "ruler",
};
