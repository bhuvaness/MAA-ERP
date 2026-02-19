// ============================================================================
// PayanarssType Import Utilities
// ============================================================================
// Handles: JSON parsing, schema validation, ID regeneration, hierarchy
// re-linking, duplicate detection, and parent reassignment.
//
// KEY DESIGN DECISIONS:
// 1. Every imported node gets a NEW unique Id (UUID v4)
// 2. The root-level nodes' ParentId is set to the currently selected node's Id
// 3. Internal parent-child relationships are preserved via an oldId→newId map
// 4. Validation runs BEFORE any mutation — partial imports never happen
// 5. Duplicate detection compares by Name + Type within the same parent scope
// ============================================================================

import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Core PayanarssType structure — mirrors your DB/JSON schema */
export interface PayanarssType {
  Id: string;
  Name: string;
  Description?: string;
  Type: string;
  ParentId: string | null;
  Properties?: Record<string, any>;
  Children?: PayanarssType[];
  [key: string]: any; // Allow additional metadata fields
}

/** Result object returned after a successful import */
export interface ImportResult {
  success: boolean;
  importedCount: number;
  records: PayanarssType[];
  errors: string[];
  warnings: string[];
}

/** Validation result for pre-import checks */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// 1. FILE READING
// ---------------------------------------------------------------------------

/**
 * Reads a JSON file from a File input and returns parsed content.
 * Rejects if the file is not valid JSON or not a .json file.
 */
export function readJsonFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    // Guard: only accept .json files
    if (!file.name.toLowerCase().endsWith(".json")) {
      reject(new Error("Only .json files are accepted."));
      return;
    }

    // Guard: reject excessively large files (>50 MB)
    const MAX_SIZE_MB = 50;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      reject(new Error(`File exceeds maximum size of ${MAX_SIZE_MB}MB.`));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch {
        reject(new Error("Invalid JSON format. Please check the file content."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the file. Please try again."));
    };

    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// 2. SCHEMA VALIDATION
// ---------------------------------------------------------------------------

/**
 * Required fields every PayanarssType node must have.
 * Id and ParentId will be regenerated, but must exist in source for structure.
 */
const REQUIRED_FIELDS: (keyof PayanarssType)[] = ["Id", "Name", "Type"];

/**
 * Validates a single PayanarssType node against the expected schema.
 * Returns an array of error messages (empty = valid).
 */
function validateNode(node: any, path: string): string[] {
  const errors: string[] = [];

  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    errors.push(`${path}: Expected an object, got ${typeof node}.`);
    return errors; // Can't validate further
  }

  // Check required fields exist and have correct types
  for (const field of REQUIRED_FIELDS) {
    if (!(field in node) || node[field] === undefined || node[field] === null) {
      errors.push(`${path}: Missing required field "${field}".`);
    }
  }

  // Name must be a non-empty string
  if (typeof node.Name === "string" && node.Name.trim().length === 0) {
    errors.push(`${path}: "Name" cannot be empty.`);
  }

  // Type must be a non-empty string
  if (typeof node.Type === "string" && node.Type.trim().length === 0) {
    errors.push(`${path}: "Type" cannot be empty.`);
  }

  // Recursively validate children if present
  if ("Children" in node && node.Children !== undefined) {
    if (!Array.isArray(node.Children)) {
      errors.push(`${path}: "Children" must be an array.`);
    } else {
      node.Children.forEach((child: any, index: number) => {
        const childPath = `${path}.Children[${index}]`;
        errors.push(...validateNode(child, childPath));
      });
    }
  }

  return errors;
}

/**
 * Validates the entire imported JSON structure.
 * Accepts both a single PayanarssType object and an array of them.
 *
 * CRITICAL: This runs BEFORE any data transformation.
 * If validation fails, nothing is imported — no partial data.
 */
export function validateImportData(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Normalize: wrap a single object in an array
  const nodes: any[] = Array.isArray(data) ? data : [data];

  if (nodes.length === 0) {
    errors.push("Import file contains no data.");
    return { isValid: false, errors, warnings };
  }

  // Validate every node recursively
  nodes.forEach((node, index) => {
    const path = `Root[${index}]`;
    errors.push(...validateNode(node, path));
  });

  // Warn if import is very large
  const totalCount = countNodes(nodes);
  if (totalCount > 500) {
    warnings.push(
      `Large import detected (${totalCount} nodes). This may take a moment.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Recursively counts all nodes including nested children */
function countNodes(nodes: any[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (Array.isArray(node.Children)) {
      count += countNodes(node.Children);
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// 3. ID REGENERATION & HIERARCHY TRANSFORMATION
// ---------------------------------------------------------------------------

/**
 * Builds a mapping from old Ids to newly generated UUIDs.
 * This map is used to re-link parent-child relationships.
 *
 * WHY: We cannot reuse Ids from the source file because they may
 * collide with existing Ids in the database. Fresh UUIDs guarantee
 * uniqueness while the oldId→newId map preserves internal hierarchy.
 */
function buildIdMap(nodes: PayanarssType[]): Map<string, string> {
  const idMap = new Map<string, string>();

  function traverse(nodeList: PayanarssType[]) {
    for (const node of nodeList) {
      // Generate a new UUID for each node
      idMap.set(node.Id, uuidv4());

      // Recurse into children
      if (Array.isArray(node.Children) && node.Children.length > 0) {
        traverse(node.Children);
      }
    }
  }

  traverse(nodes);
  return idMap;
}

/**
 * Flattens a hierarchical PayanarssType tree into a flat array.
 * Each node's ParentId is correctly set:
 *   - Root-level nodes → ParentId = selectedParentId (the currently selected node)
 *   - Child nodes → ParentId = their parent's NEW Id (from idMap)
 *
 * CRITICAL LOGIC:
 * This is where hierarchy is preserved. The recursive walk ensures
 * every child points to its parent's regenerated Id, not the old one.
 * The only ParentId that changes to an "external" value is the root level.
 */
function flattenAndTransform(
  nodes: PayanarssType[],
  selectedParentId: string,
  idMap: Map<string, string>
): PayanarssType[] {
  const flatList: PayanarssType[] = [];

  function traverse(nodeList: PayanarssType[], parentId: string) {
    for (const node of nodeList) {
      const newId = idMap.get(node.Id)!;

      // Create transformed node — strip Children (they become separate records)
      const transformedNode: PayanarssType = {
        ...node,
        Id: newId,               // New unique Id
        ParentId: parentId,      // Re-linked parent
      };

      // Remove Children array from the flat record
      // (children are stored as separate records with ParentId references)
      delete transformedNode.Children;

      flatList.push(transformedNode);

      // Recurse: children's ParentId = this node's NEW Id
      if (Array.isArray(node.Children) && node.Children.length > 0) {
        traverse(node.Children, newId);
      }
    }
  }

  // Root-level nodes get the selected node as their parent
  traverse(nodes, selectedParentId);

  return flatList;
}

// ---------------------------------------------------------------------------
// 4. DUPLICATE DETECTION
// ---------------------------------------------------------------------------

/**
 * Checks for duplicates between imported records and existing records.
 * A duplicate is defined as: same Name + same Type + same ParentId.
 *
 * WHY Name+Type+ParentId: Two fields with the same name under different
 * parents are valid (e.g., "Name" field in both "Customer" and "Product").
 * But the same Name+Type under the same parent is almost certainly a duplicate.
 */
export function detectDuplicates(
  importedRecords: PayanarssType[],
  existingRecords: PayanarssType[]
): { duplicates: PayanarssType[]; unique: PayanarssType[] } {
  // Build a Set of existing record signatures for O(1) lookup
  const existingSignatures = new Set(
    existingRecords.map((r) => buildSignature(r))
  );

  // Also track signatures within the import batch itself
  const importBatchSignatures = new Set<string>();

  const duplicates: PayanarssType[] = [];
  const unique: PayanarssType[] = [];

  for (const record of importedRecords) {
    const signature = buildSignature(record);

    if (existingSignatures.has(signature) || importBatchSignatures.has(signature)) {
      duplicates.push(record);
    } else {
      unique.push(record);
      importBatchSignatures.add(signature);
    }
  }

  return { duplicates, unique };
}

/** Creates a unique signature string for duplicate comparison */
function buildSignature(record: PayanarssType): string {
  return `${record.Name?.trim().toLowerCase()}|${record.Type?.trim().toLowerCase()}|${record.ParentId}`;
}

// ---------------------------------------------------------------------------
// 5. ORPHAN DETECTION
// ---------------------------------------------------------------------------

/**
 * Ensures no orphan nodes exist after transformation.
 * An orphan is a node whose ParentId doesn't match any other node's Id
 * AND doesn't match the selectedParentId.
 *
 * This should never happen if flattenAndTransform works correctly,
 * but we verify as a safety net before committing to the database.
 */
function detectOrphans(
  records: PayanarssType[],
  selectedParentId: string
): PayanarssType[] {
  const allIds = new Set(records.map((r) => r.Id));
  allIds.add(selectedParentId); // The selected parent is a valid target

  return records.filter(
    (r) => r.ParentId !== null && !allIds.has(r.ParentId)
  );
}

// ---------------------------------------------------------------------------
// 6. MAIN IMPORT HANDLER
// ---------------------------------------------------------------------------

/**
 * Master import function — orchestrates the full pipeline:
 *
 * 1. Read & parse JSON file
 * 2. Validate schema (reject if invalid — no partial imports)
 * 3. Build Id mapping (old → new UUIDs)
 * 4. Flatten hierarchy with re-linked ParentIds
 * 5. Detect orphans (safety check)
 * 6. Detect duplicates against existing data
 * 7. Return clean, import-ready records
 *
 * @param file          - The uploaded .json File object
 * @param selectedParentId - Id of the currently selected PayanarssType node
 * @param existingRecords  - Current records in the system (for duplicate check)
 */
export async function handlePayanarssTypeImport(
  file: File,
  selectedParentId: string,
  existingRecords: PayanarssType[]
): Promise<ImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---- STEP 1: Parse the JSON file ----
  let rawData: any;
  try {
    rawData = await readJsonFile(file);
  } catch (error: any) {
    return {
      success: false,
      importedCount: 0,
      records: [],
      errors: [error.message],
      warnings: [],
    };
  }

  // ---- STEP 2: Validate schema ----
  // CRITICAL: If validation fails, we stop here. No partial data is imported.
  const validation = validateImportData(rawData);
  if (!validation.isValid) {
    return {
      success: false,
      importedCount: 0,
      records: [],
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }
  warnings.push(...validation.warnings);

  // Normalize input: accept both single object and array
  const sourceNodes: PayanarssType[] = Array.isArray(rawData)
    ? rawData
    : [rawData];

  // ---- STEP 3: Generate new Ids ----
  // Every node gets a fresh UUID. The old→new mapping preserves hierarchy.
  const idMap = buildIdMap(sourceNodes);

  // ---- STEP 4: Flatten & transform hierarchy ----
  // Root nodes' ParentId → selectedParentId
  // Child nodes' ParentId → their parent's NEW Id
  const transformedRecords = flattenAndTransform(
    sourceNodes,
    selectedParentId,
    idMap
  );

  // ---- STEP 5: Orphan check (safety net) ----
  const orphans = detectOrphans(transformedRecords, selectedParentId);
  if (orphans.length > 0) {
    errors.push(
      `Data integrity error: ${orphans.length} orphan node(s) detected. ` +
      `Nodes: ${orphans.map((o) => `"${o.Name}"`).join(", ")}. Import aborted.`
    );
    return {
      success: false,
      importedCount: 0,
      records: [],
      errors,
      warnings,
    };
  }

  // ---- STEP 6: Duplicate detection ----
  const { duplicates, unique } = detectDuplicates(
    transformedRecords,
    existingRecords
  );

  if (duplicates.length > 0) {
    warnings.push(
      `${duplicates.length} duplicate(s) skipped: ${duplicates
        .map((d) => `"${d.Name}"`)
        .join(", ")}`
    );
  }

  if (unique.length === 0) {
    errors.push("All records in the file are duplicates. Nothing to import.");
    return {
      success: false,
      importedCount: 0,
      records: [],
      errors,
      warnings,
    };
  }

  // ---- STEP 7: Return import-ready records ----
  return {
    success: true,
    importedCount: unique.length,
    records: unique,
    errors: [],
    warnings,
  };
}
