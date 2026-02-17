export interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: (number | { Id: string; Value: string })[];
  Description: string | null;
}

export interface PayanarssTypeNode extends PayanarssType {
  children: PayanarssTypeNode[];
  isExpanded?: boolean;
}

export interface PayanarssTypeFormData {
  Name: string;
  Description: string;
  PayanarssTypeId: string;
  ParentId: string;
}

export const ROOT_TYPE_IDS = {
  VALUE_TYPE: "100000000000000000000000000000000",
  TABLE_TYPE: "100000000000000000000000000000001",
  CHILD_TABLE_TYPE: "100000000000000000000000000000002",
  LOOKUP_TYPE: "100000000000000000000000000000003",
  GROUP_TYPE: "100000000000000000000000000000004",
  ATTRIBUTE_TYPE: "100000000000000000000000000000005",
  TEXT: "100000000000000000000000000000006",
  NUMBER: "100000000000000000000000000000007",
  DATETIME: "100000000000000000000000000000008",
  BOOLEAN: "100000000000000000000000000000009",
} as const;
