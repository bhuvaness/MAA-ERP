/**
 * pineconeService.ts
 * ==================
 * Direct browser → Pinecone integration. No Supabase edge functions.
 *
 * SETUP: Add to your .env file:
 *   VITE_PINECONE_API_KEY=pcsk_...
 *   VITE_ANTHROPIC_API_KEY=sk-ant-...
 *
 * EMBEDDING STRATEGY — Three-layer per node:
 *   1. ancestry       — node + children list (top-down discovery)
 *   2. activated_context — node + parent desc + ActivationRule + branch conditions (RAG / reasoning)
 *   3. path           — breadcrumb string (navigation retrieval)
 *
 * Vector IDs: {nodeId}__ancestry | {nodeId}__context | {nodeId}__path
 * All three share the same base node metadata + a `vector_type` discriminator.
 *
 * Leaf-level column nodes are skipped entirely (same as before).
 */

import { PayanarssType } from "@/types/PayanarssType";

// ─── Constants ────────────────────────────────────────────────────────────────

const PINECONE_INDEX_HOST =
  "maa-erp-types-y3f7eec.svc.aped-4627-b74a.pinecone.io";
const PINECONE_API_BASE = "https://api.pinecone.io";
const PINECONE_NAMESPACE = "payanarss-types";
const PINECONE_EMBED_MODEL = "multilingual-e5-large";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const EMBEDDABLE_LEVELS = new Set(["sector", "module", "submodule", "usecase", "table", "biz_settings_value"]);

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface EmbedProgress {
  totalNodes: number;
  totalVectors: number;
  embeddedVectors: number;
  skippedNodes: number;
  currentBatch: number;
  totalBatches: number;
  status: "idle" | "enriching" | "embedding" | "upserting" | "complete" | "error";
  error?: string;
}

export interface EmbedResponse {
  success: boolean;
  totalNodes: number;
  totalVectors: number;
  skippedNodes: number;
  error?: string;
}

export interface QueryResult {
  id: string;           // base node ID (suffix stripped)
  vectorId: string;     // full Pinecone vector ID
  score: number;
  metadata: {
    name: string;
    description: string;
    // Hierarchy
    level: string;
    sector: string;
    module: string;
    submodule: string;
    usecase: string;
    path: string;
    is_common: boolean;
    // Relations
    parent_name: string;
    child_count: number;
    // Table-specific
    column_names: string;
    column_types: string;
    column_count: number;
    table_count: number;
    // BusinessProfileFlags
    required_flags: string;   // JSON array string e.g. '["hasSales","hasRetail"]'
    always_on: boolean;
    // Three-layer discriminator
    vector_type: "ancestry" | "activated_context" | "path" | "biz_settings_value";
    // ActivationRule
    activation_rule_type: string;
    activation_rule_source: string;
    activation_rule_value: string;
    branch_conditions: string;  // JSON string
    // Ancestry chain
    ancestor_names: string;     // pipe-separated
    ancestor_types: string;     // pipe-separated PayanarssTypeIds
    // Debug
    embedding_text: string;
  };
}

export interface QueryResponse {
  success: boolean;
  query: string;
  detectedSector?: string;
  searchMethod?: string;
  results: QueryResult[];
  aiSummary: string;
  error?: string;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface EnrichedRecord {
  id: string;
  text: string;
  metadata: QueryResult["metadata"];
}

interface ActivationRule {
  RuleType: "LookupMatch" | "Expression";
  SourceField?: string;
  MatchValue?: string;
  Expression?: string;
  ExpressionFields?: string[];
}

interface ConditionBranch {
  condition: string;
  branchName: string;
  children: string[];
}

// ─── Hierarchy Helpers ────────────────────────────────────────────────────────

function buildIndex(allTypes: PayanarssType[]): {
  byId: Map<string, PayanarssType>;
  childrenMap: Map<string, PayanarssType[]>;
} {
  const byId = new Map(allTypes.map((t) => [t.Id, t]));
  const childrenMap = new Map<string, PayanarssType[]>();

  for (const t of allTypes) {
    if (t.ParentId && t.ParentId !== t.Id) {
      if (!childrenMap.has(t.ParentId)) childrenMap.set(t.ParentId, []);
      childrenMap.get(t.ParentId)!.push(t);
    }
  }
  return { byId, childrenMap };
}

function getAncestors(
  type: PayanarssType,
  byId: Map<string, PayanarssType>
): PayanarssType[] {
  const ancestors: PayanarssType[] = [];
  let current = type;
  const visited = new Set<string>();

  while (current.ParentId && current.ParentId !== current.Id && !visited.has(current.ParentId)) {
    visited.add(current.Id);
    const parent = byId.get(current.ParentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

function getLevel(ancestors: PayanarssType[], node?: PayanarssType): string {
  // BusinessSettingsValueType nodes always get level "biz_settings_value" regardless of depth
  if (node && node.PayanarssTypeId === BIZ_SETTINGS_VALUE_TYPE_ID) return "biz_settings_value";
  const depth = ancestors.length;
  if (depth === 0) return "root";
  if (depth === 1) return "sector";
  if (depth === 2) return "module";
  if (depth === 3) return "submodule";
  if (depth === 4) return "usecase";
  if (depth === 5) return "table";
  return "column";
}

function inferColType(desc: string): string {
  const d = (desc || "").toUpperCase();
  if (d.includes("LOOKUP")) return "LOOKUP";
  if (d.includes("DATETIME")) return "DATETIME";
  if (d.includes("DATE")) return "DATE";
  if (d.includes("BOOLEAN")) return "BOOLEAN";
  if (d.includes("DECIMAL") || d.includes("INTEGER") || d.includes("INT")) return "NUMBER";
  return "STRING";
}

function countTablesInSubtree(
  nodeId: string,
  childrenMap: Map<string, PayanarssType[]>,
  depth = 0
): number {
  if (depth > 6) return 0;
  const kids = childrenMap.get(nodeId) || [];
  let count = 0;
  for (const kid of kids) {
    // Heuristic: nodes at depth 5 from root are "table" level
    count += 1 + countTablesInSubtree(kid.Id, childrenMap, depth + 1);
  }
  return count;
}

// ─── ActivationRule Extraction ─────────────────────────────────────────────────

/**
 * Safely extracts ActivationRule from a node's Attributes array.
 * Handles both { AttributeKey, AttributeValue } and legacy { Id, Value } shapes.
 */
function extractActivationRule(node: PayanarssType): ActivationRule | null {
  if (!node.Attributes || node.Attributes.length === 0) return null;

  for (const attr of node.Attributes) {
    if (typeof attr !== "object" || attr === null) continue;

    const a = attr as Record<string, unknown>;

    // New shape: { AttributeKey: "ActivationRule", AttributeValue: {...} }
    if (a["AttributeKey"] === "ActivationRule" && a["AttributeValue"]) {
      return a["AttributeValue"] as ActivationRule;
    }

    // Legacy shape: { Id: "ActivationRule", Value: "{...}" }
    if (a["Id"] === "ActivationRule" && typeof a["Value"] === "string") {
      try {
        return JSON.parse(a["Value"] as string) as ActivationRule;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function formatActivationRule(rule: ActivationRule | null): {
  ruleType: string;
  ruleSource: string;
  ruleValue: string;
  text: string;
} {
  if (!rule) return { ruleType: "", ruleSource: "", ruleValue: "", text: "" };

  if (rule.RuleType === "LookupMatch") {
    return {
      ruleType: "LookupMatch",
      ruleSource: rule.SourceField || "",
      ruleValue: rule.MatchValue || "",
      text: `ActivationRule: LookupMatch — ${rule.SourceField} = '${rule.MatchValue}'`,
    };
  }

  if (rule.RuleType === "Expression") {
    return {
      ruleType: "Expression",
      ruleSource: (rule.ExpressionFields || []).join(","),
      ruleValue: rule.Expression || "",
      text: `ActivationRule: Expression — ${rule.Expression}`,
    };
  }

  return { ruleType: "", ruleSource: "", ruleValue: "", text: "" };
}

function resolveBranchConditions(
  node: PayanarssType,
  childrenMap: Map<string, PayanarssType[]>,
  byId: Map<string, PayanarssType>
): ConditionBranch[] {
  const kids = childrenMap.get(node.Id) || [];
  const branches: ConditionBranch[] = [];

  for (const kid of kids) {
    const rule = extractActivationRule(kid);
    if (!rule || rule.RuleType !== "Expression") continue;

    const grandchildren = (childrenMap.get(kid.Id) || []).map((g) => g.Name);
    branches.push({
      condition: rule.Expression || "",
      branchName: kid.Name,
      children: grandchildren,
    });
  }

  return branches;
}

// ─── BusinessProfileFlag Helpers ─────────────────────────────────────────────

/**
 * Maps internal flag keys to human-readable descriptions for embedding text.
 * This makes the embedding semantically meaningful for similarity queries
 * like "I sell gym memberships" → matches nodes with hasSales flag.
 */
const FLAG_DESCRIPTIONS: Record<string, string> = {
  hasSales:          "applicable when the business sells products or services",
  hasRetail:         "applicable when the business has retail or point-of-sale operations",
  hasOnlineBooking:  "applicable when the business accepts online bookings or appointments",
  hasManufacturing:  "applicable when the business manufactures or produces goods",
  hasSubscription:   "applicable when the business has subscription or membership plans",
  hasDelivery:       "applicable when the business offers delivery or logistics",
  hasMultiBranch:    "applicable when the business operates multiple locations or branches",
  hasStaff:          "applicable when the business employs staff or trainers",
  hasInventory:      "applicable when the business manages physical inventory or stock",
  hasOnlineSales:    "applicable when the business sells through online channels",
};

function formatFlagsForEmbedding(flags: string[]): string {
  if (!flags || flags.length === 0) return "";
  const descriptions = flags.map(
    (f) => FLAG_DESCRIPTIONS[f] ?? `applicable when ${f} is enabled`
  );
  return `Applicable when: ${descriptions.join("; ")}`;
}

// ─── Three-Layer Text Builders ────────────────────────────────────────────────

function buildAncestryText(
  node: PayanarssType,
  ancestors: PayanarssType[],
  kids: PayanarssType[],
  level: string,
  activationText: string,
  flagsText: string
): string {
  const path = [...ancestors.map((a) => a.Name), node.Name].join(" > ");
  const desc = node.Description || "";
  const childList = kids.map((c) => c.Name).join(" | ");
  const sector = ancestors[1]?.Name || "";
  const module = ancestors[2]?.Name || "";

  const parts: string[] = [
    `[${level}] ${node.Name}`,
    `Path: ${path}`,
    `Description: ${desc}`,
  ];

  if (flagsText) parts.push(flagsText);
  if (childList) parts.push(`Contains: ${childList}`);
  if (sector) parts.push(`Sector: ${sector}`);
  if (module && level !== "module") parts.push(`Module: ${module}`);
  if (activationText) parts.push(activationText);

  return parts.filter(Boolean).join("\n");
}

function buildActivatedContextText(
  node: PayanarssType,
  ancestors: PayanarssType[],
  kids: PayanarssType[],
  level: string,
  activationText: string,
  branches: ConditionBranch[],
  childrenMap: Map<string, PayanarssType[]>,
  flagsText: string
): string {
  const path = [...ancestors.map((a) => a.Name), node.Name].join(" > ");
  const desc = node.Description || "";
  const parent = ancestors.at(-1);
  const sector = ancestors[1]?.Name || "";
  const module = ancestors[2]?.Name || "";

  const parts: string[] = [
    `[${level}] ${node.Name}`,
    `Path: ${path}`,
  ];

  if (parent) {
    parts.push(`Parent: ${parent.Name}${parent.Description ? ` — ${parent.Description}` : ""}`);
  }

  if (flagsText) parts.push(flagsText);
  if (activationText) parts.push(activationText);

  if (branches.length > 0) {
    const branchLines = branches.map(
      (b) =>
        `  IF ${b.condition} → ${b.branchName}${b.children.length > 0 ? `: ${b.children.join(", ")}` : ""}`
    );
    parts.push("Branches:\n" + branchLines.join("\n"));
  } else if (kids.length > 0) {
    if (level === "table") {
      const cols = kids
        .map((c) => `${c.Name}:${inferColType(c.Description || "")}`)
        .join(", ");
      parts.push(`Columns: ${cols}`);
    } else {
      parts.push(`Children: ${kids.map((c) => c.Name).join(" | ")}`);
    }
  }

  if (desc) parts.push(`Description: ${desc}`);
  if (sector) parts.push(`Sector: ${sector}`);
  if (module && level !== "module") parts.push(`Module: ${module}`);

  return parts.filter(Boolean).join("\n");
}

function buildPathText(
  node: PayanarssType,
  ancestors: PayanarssType[]
): string {
  return [...ancestors.map((a) => a.Name), node.Name].join(" > ");
}

// ─── BusinessSettingsValueType helpers ───────────────────────────────────────────────────

const BIZ_SETTINGS_VALUE_TYPE_ID = "10000000000000000000000000000000222";
const BIZ_PROFILE_SETTINGS_TYPE_ID = "10000000000000000000000000000000333";
const BIZ_USE_CASE_SETTINGS_TYPE_ID = "10000000000000000000000000000000444";

/**
 * Returns true if a node is an BusinessSettingsValueType node.
 */
function isSettingsValue(node: PayanarssType): boolean {
  return node.PayanarssTypeId === BIZ_SETTINGS_VALUE_TYPE_ID;
}

/**
 * Returns true if a node is a BusinessProfileSettings / BusinessUseCaseSettings node.
 * These are the "Business Profile Flags" grouping nodes — not embedded
 * themselves but used to identify their BusinessSettingsValueType children.
 */
function isSettingsContainer(node: PayanarssType): boolean {
  return node.PayanarssTypeId === BIZ_PROFILE_SETTINGS_TYPE_ID ||
         node.PayanarssTypeId === BIZ_USE_CASE_SETTINGS_TYPE_ID;
}

/**
 * Build embedding text for an BusinessSettingsValueType node.
 * The text is optimised for semantic retrieval — it encodes:
 *   - the flag key (node Name)
 *   - the intent question (node Description)
 *   - the sector / use case context (ancestor path)
 *
 * Example output:
 *   [biz_settings_value] hasSales
 *   Question: Does your business sell products or services to customers?
 *   Context: Gym & Fitness > Define Business Vision and Goals
 *   Applicable when: business sells products or services
 */
function buildSettingsValueText(
  node: PayanarssType,
  ancestors: PayanarssType[]
): string {
  const path = [...ancestors.map((a) => a.Name), node.Name].join(" > ");
  const question = node.Description || "";
  const sector = ancestors[1]?.Name || "";
  const parent = ancestors.at(-1);

  const parts: string[] = [
    `[biz_settings_value] ${node.Name}`,
    `Question: ${question}`,
    `Path: ${path}`,
  ];

  if (parent && parent.Name !== "Business Profile Flags") {
    parts.push(`Context: ${parent.Name}`);
  }
  if (sector) {
    parts.push(`Sector: ${sector}`);
  }

  return parts.filter(Boolean).join("\n");
}

// ─── Core Enrichment ──────────────────────────────────────────────────────────

/**
 * Transforms flat PayanarssType[] into enriched embedding records.
 * Produces up to 3 vectors per node (ancestry, activated_context, path).
 * Leaf columns are skipped.
 */
export function enrichAllTypes(allTypes: PayanarssType[]): EnrichedRecord[] {
  const { byId, childrenMap } = buildIndex(allTypes);
  const records: EnrichedRecord[] = [];

  for (const node of allTypes) {
    const ancestors = getAncestors(node, byId);
    const level = getLevel(ancestors, node);

    if (!EMBEDDABLE_LEVELS.has(level)) continue;

    // ── BusinessSettingsValueType — single dedicated vector, no three-layer treatment ──
    if (isSettingsValue(node)) {
      const flagText = buildSettingsValueText(node, ancestors);
      const sector = ancestors[1]?.Name || "";
      const path = [...ancestors.map((a) => a.Name), node.Name].join(" > ");
      const parentName = ancestors.at(-1)?.Name || "";

      records.push({
        id: `${node.Id}__biz_settings_value`,
        text: flagText,
        metadata: {
          name: node.Name,
          description: node.Description || "",
          level: "biz_settings_value",
          sector,
          module: ancestors[2]?.Name || "",
          submodule: ancestors[3]?.Name || "",
          usecase: ancestors[4]?.Name || "",
          path,
          is_common: false,
          parent_name: parentName,
          child_count: 0,
          column_names: "",
          column_types: "",
          column_count: 0,
          table_count: 0,
          activation_rule_type: "",
          activation_rule_source: "",
          activation_rule_value: "",
          branch_conditions: "",
          ancestor_names: ancestors.map((a) => a.Name).join("|"),
          ancestor_types: ancestors.map((a) => a.PayanarssTypeId).join("|"),
          required_flags: "[]",
          always_on: true,
          vector_type: "biz_settings_value",
          embedding_text: flagText,
        } as QueryResult["metadata"],
      });
      continue; // skip three-layer treatment
    }


    const desc = node.Description || "";

    // ── Hierarchy context ──
    const sector = ancestors[1]?.Name || "";
    const module = ancestors[2]?.Name || "";
    const submodule = ancestors[3]?.Name || "";
    const usecase = ancestors[4]?.Name || "";
    const path = [...ancestors.map((a) => a.Name), node.Name].join(" > ");
    const parentName = ancestors.at(-1)?.Name || "";
    const ancestorNames = ancestors.map((a) => a.Name).join("|");
    const ancestorTypeIds = ancestors.map((a) => a.PayanarssTypeId).join("|");

    // ── Table-specific fields ──
    const isTable = level === "table";
    const colNames = isTable ? kids.map((c) => c.Name).join(",") : "";
    const colTypes = isTable
      ? kids.map((c) => inferColType(c.Description || "")).join(",")
      : "";
    const tableCount =
      level !== "table" && level !== "usecase"
        ? countTablesInSubtree(node.Id, childrenMap)
        : 0;

    // ── ActivationRule ──
    const rule = extractActivationRule(node);
    const {
      ruleType,
      ruleSource,
      ruleValue,
      text: activationText,
    } = formatActivationRule(rule);

    // ── Branch conditions (children with Expression rules) ──
    const branches = resolveBranchConditions(node, childrenMap, byId);
    const branchConditionsJson =
      branches.length > 0 ? JSON.stringify(branches) : "";

    // ── BusinessProfileFlags ──
    const requiredFlags: string[] = node.requiredFlags ?? [];
    const alwaysOn: boolean =
      node.alwaysOn !== undefined ? node.alwaysOn : requiredFlags.length === 0;
    const flagsText = formatFlagsForEmbedding(requiredFlags);

    // ── Shared metadata base ──
    const baseMetadata = {
      name: node.Name,
      description: desc,
      level,
      sector,
      module,
      submodule,
      usecase,
      path,
      is_common: sector === "Common Modules",
      parent_name: parentName,
      child_count: kids.length,
      column_names: colNames,
      column_types: colTypes,
      column_count: isTable ? kids.length : 0,
      table_count: tableCount,
      activation_rule_type: ruleType,
      activation_rule_source: ruleSource,
      activation_rule_value: ruleValue,
      branch_conditions: branchConditionsJson,
      ancestor_names: ancestorNames,
      ancestor_types: ancestorTypeIds,
      // BusinessProfileFlags — stored as JSON string for Pinecone metadata
      required_flags: requiredFlags.length > 0 ? JSON.stringify(requiredFlags) : "[]",
      always_on: alwaysOn,
    };

    // ── Layer 1: Ancestry ──────────────────────────────────────────────────
    const ancestryText = buildAncestryText(
      node, ancestors, kids, level, activationText, flagsText
    );
    records.push({
      id: `${node.Id}__ancestry`,
      text: ancestryText,
      metadata: {
        ...baseMetadata,
        vector_type: "ancestry",
        embedding_text: ancestryText,
      } as QueryResult["metadata"],
    });

    // ── Layer 2: Activated Context ─────────────────────────────────────────
    const contextText = buildActivatedContextText(
      node, ancestors, kids, level, activationText, branches, childrenMap, flagsText
    );
    records.push({
      id: `${node.Id}__context`,
      text: contextText,
      metadata: {
        ...baseMetadata,
        vector_type: "activated_context",
        embedding_text: contextText,
      } as QueryResult["metadata"],
    });

    // ── Layer 3: Path (skip leaf tables for brevity) ───────────────────────
    if (level !== "table") {
      const pathText = buildPathText(node, ancestors);
      records.push({
        id: `${node.Id}__path`,
        text: pathText,
        metadata: {
          ...baseMetadata,
          vector_type: "path",
          embedding_text: pathText,
        } as QueryResult["metadata"],
      });
    }
  }

  return records;
}

// ─── Pinecone API Helpers ─────────────────────────────────────────────────────

function getPineconeKey(): string {
  const key = import.meta.env.VITE_PINECONE_API_KEY;
  if (!key) {
    throw new Error(
      "Pinecone API key not configured. Add VITE_PINECONE_API_KEY to your .env file."
    );
  }
  return key;
}

function getAnthropicKey(): string {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to your .env file."
    );
  }
  return key;
}

/**
 * Embed a batch of texts using Pinecone's hosted multilingual-e5-large model.
 * Returns one float[] per input text.
 * inputType: "passage" for documents to store, "query" for search queries.
 */
async function pineconeEmbed(
  texts: string[],
  inputType: "passage" | "query",
  apiKey: string
): Promise<number[][]> {
  const response = await fetch(`${PINECONE_API_BASE}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": "2025-01",
    },
    body: JSON.stringify({
      model: PINECONE_EMBED_MODEL,
      inputs: texts.map((t) => ({ text: t })),
      parameters: {
        input_type: inputType,
        truncate: "END",
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Pinecone embed error: ${(err as { message?: string }).message || response.status}`
    );
  }

  const data = await response.json() as { data: { values: number[] }[] };
  return data.data.map((d) => d.values);
}

/**
 * Upsert pre-embedded vectors into Pinecone.
 */
async function pineconeUpsert(
  vectors: { id: string; values: number[]; metadata: Record<string, unknown> }[],
  apiKey: string
): Promise<number> {
  const response = await fetch(`https://${PINECONE_INDEX_HOST}/vectors/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": "2025-01",
    },
    body: JSON.stringify({
      vectors,
      namespace: PINECONE_NAMESPACE,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Pinecone upsert error: ${(err as { message?: string }).message || response.status}`
    );
  }

  const data = await response.json() as { upsertedCount?: number };
  return data.upsertedCount ?? vectors.length;
}

/**
 * Query Pinecone with a pre-embedded vector.
 */
async function pineconeQuery(
  vector: number[],
  topK: number,
  filter: Record<string, unknown> | undefined,
  apiKey: string
): Promise<{ id: string; score: number; metadata: Record<string, unknown> }[]> {
  const body: Record<string, unknown> = {
    vector,
    topK,
    includeMetadata: true,
    namespace: PINECONE_NAMESPACE,
  };
  if (filter) body.filter = filter;

  const response = await fetch(`https://${PINECONE_INDEX_HOST}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": "2025-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Pinecone query error: ${(err as { message?: string }).message || response.status}`
    );
  }

  const data = await response.json() as {
    matches?: { id: string; score: number; metadata: Record<string, unknown> }[];
  };
  return data.matches ?? [];
}

// ─── Main Public Functions ────────────────────────────────────────────────────

/**
 * Embed all PayanarssTypes into Pinecone using the three-layer strategy.
 * Directly from browser — no Supabase edge functions.
 *
 * Pipeline:
 *   1. Enrich all nodes → 2–3 EnrichedRecord per node
 *   2. Batch-embed texts via Pinecone /embed (30 texts per call)
 *   3. Upsert vectors into Pinecone (50 vectors per call)
 */
/**
 * Collect all descendant IDs of a given root node (inclusive).
 * Used for targeted re-indexing of a subtree.
 */
function collectSubtreeIds(
  rootId: string,
  allTypes: PayanarssType[]
): Set<string> {
  const ids = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.add(id);
    allTypes
      .filter((t) => t.ParentId === id && t.Id !== id)
      .forEach((t) => queue.push(t.Id));
  }
  return ids;
}

export async function embedTypes(
  types: PayanarssType[],
  onProgress?: (p: EmbedProgress) => void,
  /**
   * Optional: restrict embedding to a subtree rooted at this node ID.
   * When provided, only this node and all its descendants are embedded.
   * The full `types` array is still needed for hierarchy resolution
   * (ancestor paths, sibling lookups etc.) — it is not sliced.
   */
  subtreeRootId?: string
): Promise<EmbedResponse> {
  const pineconeKey = getPineconeKey();

  // Determine which node IDs to embed
  const subtreeIds = subtreeRootId
    ? collectSubtreeIds(subtreeRootId, types)
    : null;

  // Step 1: Enrich — pass full types for context, but filter output to subtree
  onProgress?.({
    totalNodes: subtreeIds ? subtreeIds.size : types.length,
    totalVectors: 0,
    embeddedVectors: 0,
    skippedNodes: 0,
    currentBatch: 0,
    totalBatches: 0,
    status: "enriching",
  });

  const allRecords = enrichAllTypes(types);
  // Filter to subtree if requested
  const records = subtreeIds
    ? allRecords.filter((r) => {
        const baseId = r.id.replace(/__context$|__ancestry$|__path$|__biz_settings_value$/, "");
        return subtreeIds.has(baseId);
      })
    : allRecords;

  const nodeCount = subtreeIds ? subtreeIds.size : types.length;
  const skippedNodes = nodeCount - Math.ceil(records.length / 2.5);
  const totalVectors = records.length;

  // Step 2: Embed texts in batches of 30
  const EMBED_BATCH = 30;
  const embedBatches = Math.ceil(records.length / EMBED_BATCH);
  const allVectors: number[][] = [];

  onProgress?.({
    totalNodes: nodeCount,
    totalVectors,
    embeddedVectors: 0,
    skippedNodes,
    currentBatch: 0,
    totalBatches: embedBatches,
    status: "embedding",
  });

  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH);
    const texts = batch.map((r) => r.text);
    const vectors = await pineconeEmbed(texts, "passage", pineconeKey);
    allVectors.push(...vectors);

    onProgress?.({
      totalNodes: nodeCount,
      totalVectors,
      embeddedVectors: allVectors.length,
      skippedNodes,
      currentBatch: Math.floor(i / EMBED_BATCH) + 1,
      totalBatches: embedBatches,
      status: "embedding",
    });

    // Rate-limit guard
    if (i + EMBED_BATCH < records.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Step 3: Upsert in batches of 50
  const UPSERT_BATCH = 50;
  const upsertBatches = Math.ceil(records.length / UPSERT_BATCH);
  let totalUpserted = 0;

  onProgress?.({
    totalNodes: nodeCount,
    totalVectors,
    embeddedVectors: totalVectors,
    skippedNodes,
    currentBatch: 0,
    totalBatches: upsertBatches,
    status: "upserting",
  });

  for (let i = 0; i < records.length; i += UPSERT_BATCH) {
    const batch = records.slice(i, i + UPSERT_BATCH);
    const vectorBatch = batch.map((rec, idx) => ({
      id: rec.id,
      values: allVectors[i + idx],
      metadata: rec.metadata as Record<string, unknown>,
    }));

    const upserted = await pineconeUpsert(vectorBatch, pineconeKey);
    totalUpserted += upserted;

    onProgress?.({
      totalNodes: nodeCount,
      totalVectors,
      embeddedVectors: totalVectors,
      skippedNodes,
      currentBatch: Math.floor(i / UPSERT_BATCH) + 1,
      totalBatches: upsertBatches,
      status: "upserting",
    });

    if (i + UPSERT_BATCH < records.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  onProgress?.({
    totalNodes: nodeCount,
    totalVectors,
    embeddedVectors: totalUpserted,
    skippedNodes,
    currentBatch: upsertBatches,
    totalBatches: upsertBatches,
    status: "complete",
  });

  return {
    success: true,
    totalNodes: nodeCount,
    totalVectors: totalUpserted,
    skippedNodes,
  };
}

/**
 * Detect the likely industry sector from the query string.
 * Used to optionally filter Pinecone results by sector metadata.
 */
function detectSector(query: string): string | null {
  const q = query.toLowerCase();
  const SECTOR_KEYWORDS: Record<string, string[]> = {
    "Gym & Fitness": ["gym", "fitness", "workout", "bodybuilder", "trainer", "membership"],
    "Healthcare": ["hospital", "clinic", "patient", "medical", "doctor", "health"],
    "Retail": ["shop", "store", "inventory", "product", "sale", "pos"],
    "Real Estate": ["property", "tenant", "lease", "rental", "building"],
    "Restaurant": ["restaurant", "menu", "order", "table", "kitchen", "food"],
    "Hotel": ["hotel", "booking", "room", "guest", "reservation", "checkin"],
  };
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((k) => q.includes(k))) return sector;
  }
  return null;
}

/**
 * Query Pinecone for matching PayanarssTypes.
 * Searches the `activated_context` layer by default for richest RAG results.
 * Falls back to unfiltered search if sector-filtered results are insufficient.
 * Generates aiSummary via Claude directly from browser.
 */
/**
 * Vector layer priority for deduplication.
 * When the same node appears via multiple layers, prefer activated_context
 * (richest for RAG) over ancestry over path.
 */
const LAYER_PRIORITY: Record<string, number> = {
  __context: 3,
  __ancestry: 2,
  __path: 1,
};

function getLayerSuffix(vectorId: string): string {
  if (vectorId.endsWith("__context")) return "__context";
  if (vectorId.endsWith("__ancestry")) return "__ancestry";
  if (vectorId.endsWith("__path")) return "__path";
  return "__path";
}

function getBaseId(vectorId: string): string {
  return vectorId.replace(/__context$|__ancestry$|__path$|__biz_settings_value$/, "");
}

/**
 * Deduplicate raw Pinecone matches by base node ID.
 * For each node, keep the match with the highest layer priority.
 * Ties broken by score.
 * Returns final list sorted by score descending.
 */
function deduplicateMatches(
  matches: { id: string; score: number; metadata: Record<string, unknown> }[],
  preferredLayer: "__context" | "__ancestry" | "__path" = "__context"
): { id: string; score: number; metadata: Record<string, unknown> }[] {
  const best = new Map<string, { id: string; score: number; metadata: Record<string, unknown> }>();

  for (const m of matches) {
    const baseId = getBaseId(m.id);
    const existing = best.get(baseId);

    if (!existing) {
      best.set(baseId, m);
      continue;
    }

    const newPriority = LAYER_PRIORITY[getLayerSuffix(m.id)] ?? 0;
    const existingPriority = LAYER_PRIORITY[getLayerSuffix(existing.id)] ?? 0;

    // Prefer higher layer priority; if equal, prefer higher score
    if (
      newPriority > existingPriority ||
      (newPriority === existingPriority && m.score > existing.score)
    ) {
      best.set(baseId, m);
    }
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score);
}

export async function queryTypes(
  query: string,
  topK: number = 15,
  options?: {
    sectorFilter?: string;
    levelFilter?: string;
    vectorTypeFilter?: "ancestry" | "activated_context" | "path";
  }
): Promise<QueryResponse> {
  try {
    const pineconeKey = getPineconeKey();
    const anthropicKey = getAnthropicKey();

    // Embed query as a retrieval query (not passage)
    const [queryVector] = await pineconeEmbed([query], "query", pineconeKey);

    const detectedSector = options?.sectorFilter ?? detectSector(query);

    // Fetch topK * 3 so that after deduplication we still have topK unique nodes.
    // No vector_type filter — we deduplicate client-side instead, which is more
    // reliable than metadata filtering on index configurations that don't index
    // every field.
    const fetchK = topK * 3;
    let searchMethod = "semantic";

    const buildFilter = (sector?: string): Record<string, unknown> | undefined => {
      const f: Record<string, unknown> = {};
      if (sector) f.sector = { $eq: sector };
      if (options?.levelFilter) f.level = { $eq: options.levelFilter };
      return Object.keys(f).length > 0 ? f : undefined;
    };

    let rawMatches: Awaited<ReturnType<typeof pineconeQuery>> = [];

    if (detectedSector) {
      rawMatches = await pineconeQuery(
        queryVector,
        fetchK,
        buildFilter(detectedSector),
        pineconeKey
      );
      searchMethod = "sector-filtered";

      // Fall back to unfiltered if too few unique nodes
      const uniqueCount = new Set(rawMatches.map((m) => getBaseId(m.id))).size;
      if (uniqueCount < 3) {
        rawMatches = await pineconeQuery(
          queryVector,
          fetchK,
          buildFilter(),
          pineconeKey
        );
        searchMethod = "semantic-fallback";
      }
    } else {
      rawMatches = await pineconeQuery(
        queryVector,
        fetchK,
        buildFilter(),
        pineconeKey
      );
    }

    // Deduplicate: one result per node, preferring activated_context layer
    const deduplicated = deduplicateMatches(rawMatches, "__context");

    // Return only topK after deduplication
    const results: QueryResult[] = deduplicated.slice(0, topK).map((m) => ({
      id: getBaseId(m.id),
      vectorId: m.id,
      score: m.score,
      metadata: m.metadata as QueryResult["metadata"],
    }));

    // Generate AI summary via Claude directly
    const aiSummary = await generateAiSummary(query, results, anthropicKey);

    return {
      success: true,
      query,
      detectedSector: detectedSector ?? undefined,
      searchMethod,
      results,
      aiSummary,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      query,
      results: [],
      aiSummary: "",
      error: errorMessage,
    };
  }
}

/**
 * Generate a natural-language summary of query results via Claude.
 * Called directly from browser — no proxy.
 */
async function generateAiSummary(
  query: string,
  results: QueryResult[],
  apiKey: string
): Promise<string> {
  if (results.length === 0) return "No matching modules found for your requirements.";

  // Build a concise results digest for Claude
  const digest = results
    .slice(0, 8)
    .map(
      (r) =>
        `• [${r.metadata.level}] ${r.metadata.name} (${(r.score * 100).toFixed(0)}% match)\n` +
        `  Path: ${r.metadata.path}\n` +
        `  ${r.metadata.description}` +
        (r.metadata.activation_rule_type
          ? `\n  ActivationRule: ${r.metadata.activation_rule_type} — ${r.metadata.activation_rule_value}`
          : "") +
        (r.metadata.branch_conditions && r.metadata.branch_conditions !== ""
          ? `\n  Branches: ${r.metadata.branch_conditions}`
          : "")
    )
    .join("\n\n");

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: `You are an ERP configuration assistant for MAA ERP. 
Given a business requirement query and matching PayanarssType modules, write a concise recommendation (3–5 sentences).
Highlight which modules to activate, note any ActivationRules or conditional branches that apply, and suggest sequencing.
Be direct and practical. No preamble.`,
        messages: [
          {
            role: "user",
            content: `Business requirement: "${query}"\n\nTop matching modules:\n${digest}`,
          },
        ],
      }),
    });

    if (!response.ok) return "";
    const data = await response.json() as { content?: { type: string; text: string }[] };
    return data.content?.find((b) => b.type === "text")?.text ?? "";
  } catch {
    return "";
  }
}

/**
 * Load PayanarssTypes from the static JSON file.
 */
export async function loadPayanarssTypes(): Promise<PayanarssType[]> {
  const response = await fetch("/data/VanakkamPayanarssTypes.json");
  if (!response.ok) {
    throw new Error("Failed to load PayanarssTypes from /data/VanakkamPayanarssTypes.json");
  }
  return response.json();
}
