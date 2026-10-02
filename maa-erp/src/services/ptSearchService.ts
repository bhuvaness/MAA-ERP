/**
 * ptSearchService.ts
 * ==================
 * Queries the maa-erp-types Pinecone index directly from the browser.
 * Replaces the Express /api/claude-match proxy.
 *
 * Architecture:
 *   Component → ptSearchService → Pinecone /embed + /query (direct)
 *   Results are hydrated from local VanakkamPayanarssTypes.json
 *   (same anti-hallucination pattern — only real IDs are returned)
 *
 * SETUP: .env must contain:
 *   VITE_PINECONE_API_KEY=pcsk_...
 *   VITE_PINECONE_INDEX_HOST=maa-erp-types-y3f7eec.svc.aped-4627-b74a.pinecone.io
 */

// ─── Types ────────────────────────────────────────────────────

export interface PTNode {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Description?: string;
}

export interface ModuleResult {
  id: string;
  name: string;
  description: string;
  typeId: string;
  typeName: string;
  parentName: string | null;
  childCount: number;
  path: string[];
  relevanceScore: string;
  reason: string;
  matchedFields: string[];
  // Enriched from Pinecone metadata
  level?: string;
  sector?: string;
  module?: string;
  activationRuleType?: string;
  activationRuleValue?: string;
  branchConditions?: string;
}

// ─── BusinessProfile ──────────────────────────────────────────
//
// Collected once at the start of a session via Viki's intent
// questions. Controls which PTS nodes are in the active subgraph.
// Stored in useVikiChat state and passed to searchModules.

export interface BusinessProfile {
  /** Business description the user typed */
  description: string;
  /** Flags set from intent questions */
  flags: Record<string, boolean>;
}

/**
 * Human-readable intent questions mapped to flag keys.
 * Viki asks these after the user describes their business.
 */
export const INTENT_QUESTIONS: { key: string; question: string }[] = [
  { key: "hasSales",         question: "Does your business sell products or services to customers?" },
  { key: "hasRetail",        question: "Do you have a retail counter or point-of-sale?" },
  { key: "hasOnlineBooking", question: "Do customers book appointments or sessions online?" },
  { key: "hasSubscription",  question: "Do you offer memberships or subscription plans?" },
  { key: "hasInventory",     question: "Do you manage physical stock or inventory?" },
  { key: "hasStaff",         question: "Do you employ staff such as trainers or assistants?" },
  { key: "hasMultiBranch",   question: "Do you operate more than one location or branch?" },
];

/**
 * Given a BusinessProfile, return the set of PTS node IDs that
 * are visible to this user — i.e. nodes where every requiredFlag
 * is present in the profile, or the node is alwaysOn.
 *
 * This is computed client-side from the local JSON — no API call.
 * Pass the result to searchModules() as activeNodeIds to restrict
 * Pinecone results to this subgraph only.
 */
export async function buildActiveSubgraph(
  profile: BusinessProfile
): Promise<Set<string>> {
  const allNodes = await loadAllTypes();
  const activeIds = new Set<string>();

  for (const node of allNodes) {
    const flags = node.requiredFlags ?? [];
    const alwaysOn = node.alwaysOn !== undefined
      ? node.alwaysOn
      : flags.length === 0;

    if (alwaysOn) {
      activeIds.add(node.Id);
      continue;
    }

    // Node is active if ALL required flags are set in the profile
    const allFlagsMet = flags.every((f) => profile.flags[f] === true);
    if (allFlagsMet) activeIds.add(node.Id);
  }

  return activeIds;
}



// ─── BusinessSettingsValueType ───────────────────────────────────────────

const BIZ_SETTINGS_VALUE_TYPE_ID = "10000000000000000000000000000000222";
const BIZ_PROFILE_SETTINGS_TYPE_ID = "10000000000000000000000000000000333";
const BIZ_USE_CASE_SETTINGS_TYPE_ID = "10000000000000000000000000000000444";

/**
 * A single intent flag node loaded from VanakkamPayanarssTypes.json.
 */
export interface BusinessSettingsValue {
  /** The flag key, e.g. "hasSales" — stored as the node Name */
  key: string;
  /** The intent question shown to the user — stored as node Description */
  question: string;
  /** Node ID in the PTS JSON */
  nodeId: string;
  /** Sector this flag belongs to, e.g. "Gym & Fitness" */
  sector: string;
  /** Use case this flag belongs to (if flag is at use-case level) */
  useCase: string;
  /** Ancestor path for display */
  path: string[];
}

/**
 * Load intent flag nodes from VanakkamPayanarssTypes.json.
 * Primary source — no API call needed.
 *
 * Strategy:
 *   1. Find all BusinessProfileSettings / BusinessUseCaseSettings nodes (type ID match — not name match)
 *   2. Walk their children to find BusinessSettingsValueType leaf nodes
 *   3. Build context from ancestors (sector, use case)
 *   4. Apply optional sector / use case filters
 *
 * @param sectorName  Optional — filter by sector name (e.g. "Gym & Fitness").
 * @param useCaseName Optional — further filter to flags under a specific use case.
 */
export async function loadBusinessSettingsValues(
  sectorName?: string,
  useCaseName?: string
): Promise<BusinessSettingsValue[]> {
  const allNodes = await loadAllTypes();
  const idMap = buildIdMap(allNodes);
  const flags: BusinessSettingsValue[] = [];

  for (const node of allNodes) {
    // Only BusinessSettingsValueType leaf nodes — identified by type ID
    if (node.PayanarssTypeId !== BIZ_SETTINGS_VALUE_TYPE_ID) continue;
    if (!node.Description) continue; // no question = not usable

    // Verify parent is a BusinessProfileSettings / BusinessUseCaseSettings (strict parent check)
    const parent = idMap.get(node.ParentId);
    if (!parent || (parent.PayanarssTypeId !== BIZ_PROFILE_SETTINGS_TYPE_ID &&
        parent.PayanarssTypeId !== BIZ_USE_CASE_SETTINGS_TYPE_ID)) continue;

    // Build ancestor path for context
    const path = getAncestorPath(node.Id, idMap);
    const sector = path[1] ?? "";
    // Use case: search ancestors above the container
    const containerIdx = path.indexOf(parent.Name);
    const useCase = containerIdx > 1 ? path[containerIdx - 1] : "";

    // Apply filters
    if (sectorName && sector !== sectorName) continue;
    if (useCaseName && useCase !== useCaseName) continue;

    flags.push({
      key: node.Name,
      question: node.Description,
      nodeId: node.Id,
      sector,
      useCase,
      path,
    });
  }

  return flags;
}

const PINECONE_API_BASE = "https://api.pinecone.io";
const PINECONE_EMBED_MODEL = "multilingual-e5-large";
const PINECONE_NAMESPACE = "payanarss-types";
const PINECONE_API_VERSION = "2025-01";

function getIndexHost(): string {
  const host = import.meta.env.VITE_PINECONE_INDEX_HOST;
  if (!host) throw new Error("VITE_PINECONE_INDEX_HOST not set in .env");
  return host;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_PINECONE_API_KEY;
  if (!key) throw new Error("VITE_PINECONE_API_KEY not set in .env");
  return key;
}

// ─── Local JSON cache ─────────────────────────────────────────

let _allTypes: PTNode[] | null = null;

async function loadAllTypes(): Promise<PTNode[]> {
  if (_allTypes) return _allTypes;
  const res = await fetch("/data/VanakkamPayanarssTypes.json");
  if (!res.ok) throw new Error("Failed to load VanakkamPayanarssTypes.json");
  _allTypes = (await res.json()) as PTNode[];
  return _allTypes;
}

function buildIdMap(nodes: PTNode[]): Map<string, PTNode> {
  return new Map(nodes.map((n) => [n.Id, n]));
}

function countChildren(nodeId: string, nodes: PTNode[]): number {
  return nodes.filter((n) => n.ParentId === nodeId && n.Id !== nodeId).length;
}

function getAncestorPath(nodeId: string, idMap: Map<string, PTNode>): string[] {
  const path: string[] = [];
  let cursor = idMap.get(nodeId);
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.Id)) {
    visited.add(cursor.Id);
    path.unshift(cursor.Name);
    if (cursor.Id === cursor.ParentId) break;
    cursor = idMap.get(cursor.ParentId);
  }
  return path;
}

function resolveTypeName(typeId: string): string {
  if (typeId.endsWith("11111")) return "Business Solution";
  if (typeId.endsWith("1111")) return "Business Module";
  if (typeId.endsWith("111")) return "Use Case";
  if (typeId.endsWith("4")) return "Group";
  if (typeId.endsWith("2")) return "Table";
  return "Module";
}

// ─── Pinecone API ─────────────────────────────────────────────

interface PineconeMatch {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(`${PINECONE_API_BASE}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      model: PINECONE_EMBED_MODEL,
      inputs: [{ text }],
      parameters: { input_type: "query", truncate: "END" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Pinecone embed error: ${err.message ?? res.status}`);
  }

  const data = await res.json() as { data: { values: number[] }[] };
  return data.data[0].values;
}

async function queryIndex(
  vector: number[],
  topK: number,
  filter: Record<string, unknown> | undefined,
  apiKey: string,
  indexHost: string
): Promise<PineconeMatch[]> {
  const body: Record<string, unknown> = {
    vector,
    topK,
    includeMetadata: true,
    namespace: PINECONE_NAMESPACE,
  };
  if (filter) body.filter = filter;

  const res = await fetch(`https://${indexHost}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": PINECONE_API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Pinecone query error: ${err.message ?? res.status}`);
  }

  const data = await res.json() as { matches?: PineconeMatch[] };
  return data.matches ?? [];
}

// ─── Deduplication ────────────────────────────────────────────
// Same strategy as designer: fetch 3× topK, deduplicate by base node ID,
// prefer activated_context > ancestry > path layer.

const LAYER_PRIORITY: Record<string, number> = {
  __context: 3,
  __ancestry: 2,
  __path: 1,
};

function getLayerSuffix(vectorId: string): string {
  if (vectorId.endsWith("__context")) return "__context";
  if (vectorId.endsWith("__ancestry")) return "__ancestry";
  return "__path";
}

function getBaseId(vectorId: string): string {
  return vectorId.replace(/__context$|__ancestry$|__path$/, "");
}

function deduplicate(matches: PineconeMatch[]): PineconeMatch[] {
  const best = new Map<string, PineconeMatch>();

  for (const m of matches) {
    const baseId = getBaseId(m.id);
    const existing = best.get(baseId);
    if (!existing) {
      best.set(baseId, m);
      continue;
    }
    const newP = LAYER_PRIORITY[getLayerSuffix(m.id)] ?? 0;
    const existP = LAYER_PRIORITY[getLayerSuffix(existing.id)] ?? 0;
    if (newP > existP || (newP === existP && m.score > existing.score)) {
      best.set(baseId, m);
    }
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score);
}

// ─── Sector detection ─────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  gym: "Gym & Fitness",
  fitness: "Gym & Fitness",
  workout: "Gym & Fitness",
  bodybuilder: "Gym & Fitness",
  restaurant: "Food & Beverage",
  hotel: "Hospitality",
  clinic: "Healthcare",
  hospital: "Healthcare",
  retail: "Retail",
  property: "Real Estate",
  "real estate": "Real Estate",
};

function detectSector(query: string): string | null {
  const q = query.toLowerCase();
  for (const [keyword, sector] of Object.entries(SECTOR_MAP)) {
    if (q.includes(keyword)) return sector;
  }
  return null;
}

// ─── Main: searchModules ──────────────────────────────────────

/**
 * Search for matching PTS modules using Pinecone semantic search.
 * Replaces the Express /api/claude-match endpoint.
 * Results are hydrated from local JSON — no hallucinated IDs.
 *
 * @param keyword  — user search text or sector keyword
 * @param topK     — max results (default 12)
 * @param profile  — optional BusinessProfile; when provided, results are
 *                   restricted to the user's active subgraph (nodes whose
 *                   requiredFlags match the profile flags).
 */
export async function searchModules(
  keyword: string,
  topK = 12,
  profile?: BusinessProfile
): Promise<ModuleResult[]> {
  console.log("[ptSearch] Querying Pinecone directly for:", keyword);

  const apiKey = getApiKey();
  const indexHost = getIndexHost();

  // 0. Pre-compute active subgraph if profile provided
  const activeIds = profile ? await buildActiveSubgraph(profile) : null;
  if (activeIds) {
    console.log(`[ptSearch] Active subgraph: ${activeIds.size} nodes`);
  }

  // 1. Embed the query
  const vector = await embedQuery(keyword, apiKey);

  // 2. Fetch 3× topK to ensure enough after deduplication
  const fetchK = topK * 3;
  const detectedSector = detectSector(keyword);

  let rawMatches: PineconeMatch[];

  if (detectedSector) {
    // Try sector-filtered first
    rawMatches = await queryIndex(
      vector,
      fetchK,
      { sector: { $eq: detectedSector } },
      apiKey,
      indexHost
    );
    console.log(`[ptSearch] Sector-filtered (${detectedSector}): ${rawMatches.length} raw`);

    // Fall back to unfiltered if too few unique nodes
    const uniqueCount = new Set(rawMatches.map((m) => getBaseId(m.id))).size;
    if (uniqueCount < 3) {
      rawMatches = await queryIndex(vector, fetchK, undefined, apiKey, indexHost);
      console.log(`[ptSearch] Fallback unfiltered: ${rawMatches.length} raw`);
    }
  } else {
    rawMatches = await queryIndex(vector, fetchK, undefined, apiKey, indexHost);
    console.log(`[ptSearch] Unfiltered: ${rawMatches.length} raw`);
  }

  // 3. Deduplicate — one result per node, preferring activated_context
  const deduped = deduplicate(rawMatches).slice(0, topK);
  console.log(`[ptSearch] After dedup: ${deduped.length} unique nodes`);

  // 4. Hydrate from local JSON — anti-hallucination guard
  const allNodes = await loadAllTypes();
  const idMap = buildIdMap(allNodes);
  const results: ModuleResult[] = [];

  for (const match of deduped) {
    const baseId = getBaseId(match.id);

    // Skip nodes outside the active subgraph
    if (activeIds && !activeIds.has(baseId)) {
      console.log(`[ptSearch] Filtered out (flag mismatch): ${baseId}`);
      continue;
    }

    const node = idMap.get(baseId);

    if (!node) {
      // ID in Pinecone but not in local JSON — skip (stale vector)
      console.warn(`[ptSearch] Stale vector ID ${baseId} — not in local JSON, skipping`);
      continue;
    }

    const parent = node.Id !== node.ParentId ? idMap.get(node.ParentId) : null;
    const meta = match.metadata;

    results.push({
      id: node.Id,
      name: node.Name,
      description: node.Description ?? "",
      typeId: node.PayanarssTypeId,
      typeName: resolveTypeName(node.PayanarssTypeId),
      parentName: parent?.Name ?? null,
      childCount: countChildren(node.Id, allNodes),
      path: getAncestorPath(node.Id, idMap),
      relevanceScore: match.score.toFixed(4),
      reason: (meta.description as string) ?? "",
      matchedFields: ["semantic"],
      // Enriched from Pinecone metadata
      level: (meta.level as string) ?? "",
      sector: (meta.sector as string) ?? "",
      module: (meta.module as string) ?? "",
      activationRuleType: (meta.activation_rule_type as string) ?? "",
      activationRuleValue: (meta.activation_rule_value as string) ?? "",
      branchConditions: (meta.branch_conditions as string) ?? "",
    });
  }

  console.log(`[ptSearch] Hydrated ${results.length} modules from local JSON`);
  return results;
}

// ─── Sector keyword extractor (unchanged) ─────────────────────

const SECTOR_KEYWORDS = [
  "gym", "fitness", "restaurant", "hotel", "clinic", "hospital",
  "school", "retail", "property", "real estate", "construction",
  "manufacturing", "logistics", "transport", "hr", "payroll",
  "finance", "accounting", "inventory", "warehouse", "crm",
  "sales", "procurement", "facilities", "sports", "recreation",
  "pest control", "cleaning", "laundry", "salon", "spa",
];

export function extractSectorKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  return SECTOR_KEYWORDS.find((w) => lower.includes(w)) ?? null;
}

// ─── Get children (unchanged) ─────────────────────────────────

export async function getModuleChildren(parentId: string): Promise<PTNode[]> {
  const allNodes = await loadAllTypes();
  return allNodes.filter((n) => n.ParentId === parentId && n.Id !== parentId);
}

// ─── Get use case children from Pinecone ──────────────────────

export interface UseCaseChild {
  id: string;           // base node ID
  name: string;
  description: string;
  level: string;
  path: string;
  childCount: number;
  columnNames: string;
  score: number;
}

/**
 * Query Pinecone for the direct table-type children of a use case node.
 *
 * Strategy:
 *   1. Embed the use case name as a query vector
 *   2. Filter by parent_name = useCaseName AND vector_type = "ancestry"
 *   3. Deduplicate and hydrate from local JSON
 *   4. Falls back to local JSON if Pinecone unavailable
 *
 * @param useCaseName  — Name of the parent use case (e.g. "Identify Target Customer Segment")
 * @param useCaseId    — Local JSON Id for fallback
 */
/**
 * Get the direct data-entry children of a use case node.
 *
 * Strategy:
 *   1. PRIMARY: Local JSON — guaranteed accurate, no filter issues
 *   2. ENRICHMENT: Pinecone — adds column_names, description, score metadata
 *      Falls back gracefully if Pinecone unavailable.
 *
 * @param useCaseName  — Name for Pinecone enrichment query
 * @param useCaseId    — Local JSON Id (primary source of truth)
 */
export async function getUseCaseChildren(
  useCaseName: string,
  useCaseId: string
): Promise<UseCaseChild[]> {
  // Step 1: Always get children from local JSON first — reliable source of truth
  const localChildren = await getUseCaseChildrenLocal(useCaseId);

  if (localChildren.length === 0) {
    console.log(`[ptSearch] No local children found for ${useCaseName} (${useCaseId})`);
    return [];
  }

  // Step 2: Try to enrich with Pinecone metadata (column_names, description from vectors)
  try {
    const apiKey = getApiKey();
    const indexHost = getIndexHost();

    // Query without filter — fetch enough to find our specific nodes by ID
    // Use the use case name as the query to find semantically related nodes
    const vector = await embedQuery(useCaseName, apiKey);
    const rawMatches = await queryIndex(
      vector,
      localChildren.length * 6, // fetch more to ensure we find all children
      undefined, // no metadata filter — avoids silent filter failures
      apiKey,
      indexHost
    );

    console.log(`[ptSearch] Pinecone enrichment for ${useCaseName}: ${rawMatches.length} raw`);

    // Build a map of base nodeId → Pinecone metadata
    const pineconeMap = new Map<string, PineconeMatch>();
    for (const match of rawMatches) {
      const baseId = getBaseId(match.id);
      // Prefer __context vectors for richest metadata
      const existing = pineconeMap.get(baseId);
      if (!existing || match.id.endsWith('__context')) {
        pineconeMap.set(baseId, match);
      }
    }

    // Enrich local children with Pinecone metadata where available
    return localChildren.map(child => {
      const match = pineconeMap.get(child.id);
      if (!match) return child;
      const meta = match.metadata;
      return {
        ...child,
        description: (meta.description as string) || child.description,
        columnNames: (meta.column_names as string) || child.columnNames,
        score: match.score,
      };
    });
  } catch (err) {
    console.warn('[ptSearch] Pinecone enrichment skipped (non-fatal):', err);
    // Return unenriched local children — still functional
    return localChildren;
  }
}

/**
 * Local JSON fallback — returns direct children of a node.
 */
async function getUseCaseChildrenLocal(useCaseId: string): Promise<UseCaseChild[]> {
  const allNodes = await loadAllTypes();
  const children = allNodes.filter(
    (n) => n.ParentId === useCaseId && n.Id !== useCaseId
  );
  console.log(`[ptSearch] Local children for ${useCaseId}:`, children.map(c => c.Name));
  return children.map((n) => ({
    id: n.Id,
    name: n.Name,
    description: n.Description ?? "",
    level: "table",
    path: "",
    childCount: allNodes.filter((c) => c.ParentId === n.Id && c.Id !== n.Id).length,
    columnNames: "",
    score: 1,
  }));
}
