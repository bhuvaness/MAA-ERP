export interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: (number | { Id: string; Value: string })[];
  Description: string | null;
  /**
   * BusinessProfileFlags that must be present in a user's session
   * for this node (and its descendants) to appear in their active subgraph.
   * Empty array / undefined = always visible (alwaysOn).
   * Example: ["hasSales", "hasRetail"]
   */
  requiredFlags?: string[];
  /**
   * When true, this node is always included regardless of session flags.
   * Overrides requiredFlags. Defaults to true when requiredFlags is empty.
   */
  alwaysOn?: boolean;
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
  requiredFlags: string[];
  alwaysOn: boolean;
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
  BUSINESS_USE_CASE: "10000000000000000000000000000000111",
  BUSINESS_MODULES: "10000000000000000000000000000001111",
  BUSINESS_SOLUTIONS: "10000000000000000000000000000011111",
  /**
   * BusinessProfileSettings / BusinessUseCaseSettings — a grouping node that holds BusinessSettingsValueType children.
   * Named "Business Profile Flags". Placed at sector level or use-case level.
   * Identified by type, not by name — no naming convention dependency.
   */
  BUSINESS_PROFILE_SETTINGS: "10000000000000000000000000000000333",
  BUSINESS_USE_CASE_SETTINGS: "10000000000000000000000000000000444",
  /**
   * BusinessSettingsValueType — a yes/no business profile flag node.
   * Parent must be a BusinessProfileSettings / BusinessUseCaseSettings node.
   * Name     = flag key, e.g. "hasSales"
   * Description = the intent question shown to the user,
   *               e.g. "Does your business sell products or services?"
   */
  BUSINESS_USE_CASE_SETTINGS_VALUE: "10000000000000000000000000000000222",
} as const;
