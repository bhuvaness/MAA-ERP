/**
 * ptSearchService.ts
 * Semantic module search for MAA ERP.
 * Calls Express server → Pinecone, then hydrates results from local JSON.
 *
 * SETUP:
 *   - Express server must be running on VITE_EXPRESS_API (default: http://localhost:3001/api)
 *   - VanakkamPayanarssTypes.json must be in public/data/
 */

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPRESS_API: string =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_EXPRESS_API ?? "http://localhost:3001/api";

const ROOT_TYPE_IDS = {
  VALUE_TYPE:         "100000000000000000000000000000000",
  TABLE_TYPE:         "100000000000000000000000000000001",
  CHILD_TABLE_TYPE:   "100000000000000000000000000000002",
  LOOKUP_TYPE:        "100000000000000000000000000000003",
  GROUP_TYPE:         "100000000000000000000000000000004",
  ATTRIBUTE_TYPE:     "100000000000000000000000000000005",
  BUSINESS_USE_CASE:  "10000000000000000000000000000000111",
  BUSINESS_MODULES:   "10000000000000000000000000000001111",
  BUSINESS_SOLUTIONS: "10000000000000000000000000000011111",
} as const;

const TYPE_LABEL: Record<string, string> = {
  [ROOT_TYPE_IDS.VALUE_TYPE]:         "Field",
  [ROOT_TYPE_IDS.TABLE_TYPE]:         "Table",
  [ROOT_TYPE_IDS.CHILD_TABLE_TYPE]:   "Child Table",
  [ROOT_TYPE_IDS.LOOKUP_TYPE]:        "Lookup",
  [ROOT_TYPE_IDS.GROUP_TYPE]:         "Module",
  [ROOT_TYPE_IDS.ATTRIBUTE_TYPE]:     "Attribute",
  [ROOT_TYPE_IDS.BUSINESS_USE_CASE]:  "Use Case",
  [ROOT_TYPE_IDS.BUSINESS_MODULES]:   "Business Module",
  [ROOT_TYPE_IDS.BUSINESS_SOLUTIONS]: "Business Solution",
};

// ─── Cache ────────────────────────────────────────────────────────────────────

let _allTypes: PTNode[] | null = null;

async function loadAllTypes(): Promise<PTNode[]> {
  if (_allTypes) return _allTypes;
  const res = await fetch("/data/VanakkamPayanarssTypes.json");
  if (!res.ok) throw new Error("Failed to load VanakkamPayanarssTypes.json");
  _allTypes = (await res.json()) as PTNode[];
  return _allTypes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildIdMap(nodes: PTNode[]): Map<string, PTNode> {
  return new Map(nodes.map((n) => [n.Id, n]));
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

function countChildren(nodeId: string, nodes: PTNode[]): number {
  return nodes.filter((n) => n.ParentId === nodeId && n.Id !== nodeId).length;
}

// ─── Pinecone match shape ─────────────────────────────────────────────────────

interface PineconeMatch {
  payanarssTypeId: string;
  score: number;
  metadata: {
    name: string;
    description: string;
    category: string;
    type: string;
    parentName: string;
  };
}

// ─── Main search — calls Express → Pinecone ───────────────────────────────────

export async function searchModules(keyword: string): Promise<ModuleResult[]> {
  let pineconeMatches: PineconeMatch[];

  try {
    const res = await fetch(`${EXPRESS_API}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: keyword, topK: 10 }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    const json = await res.json();
    pineconeMatches = (json.matches ?? []) as PineconeMatch[];
  } catch (err) {
    console.error("[ptSearch] Pinecone call failed:", (err as Error).message);
    throw new Error(`Pinecone search failed: ${(err as Error).message}`);
  }

  if (pineconeMatches.length === 0) return [];

  const allNodes = await loadAllTypes();
  const idMap = buildIdMap(allNodes);
  const results: ModuleResult[] = [];

  for (const match of pineconeMatches) {
    const node =
      idMap.get(match.payanarssTypeId) ??
      allNodes.find(
        (n) =>
          n.Name === match.metadata?.name ||
          n.Name.toLowerCase() === match.metadata?.name?.toLowerCase()
      );

    if (!node) {
      results.push({
        id:             match.payanarssTypeId,
        name:           match.metadata?.name ?? match.payanarssTypeId,
        description:    match.metadata?.description ?? "",
        typeId:         "",
        typeName:       match.metadata?.type ?? "Module",
        parentName:     match.metadata?.parentName ?? null,
        childCount:     0,
        path:           [match.metadata?.name ?? match.payanarssTypeId],
        relevanceScore: String(match.score),
        reason:         `Pinecone score: ${match.score}`,
        matchedFields:  ["name", "description"],
      });
      continue;
    }

    const parent = node.Id !== node.ParentId ? idMap.get(node.ParentId) : null;

    results.push({
      id:             node.Id,
      name:           node.Name,
      description:    node.Description ?? match.metadata?.description ?? "",
      typeId:         node.PayanarssTypeId,
      typeName:       TYPE_LABEL[node.PayanarssTypeId] ?? match.metadata?.type ?? "Node",
      parentName:     parent?.Name ?? null,
      childCount:     countChildren(node.Id, allNodes),
      path:           getAncestorPath(node.Id, idMap),
      relevanceScore: String(match.score),
      reason:         `Pinecone score: ${match.score}`,
      matchedFields:  ["name", "description"],
    });
  }

  return results;
}

// ─── Get children of a module ─────────────────────────────────────────────────

export async function getModuleChildren(parentId: string): Promise<PTNode[]> {
  const allNodes = await loadAllTypes();
  return allNodes.filter((n) => n.ParentId === parentId && n.Id !== parentId);
}

// ─── Sector keyword extractor ─────────────────────────────────────────────────

const SECTOR_KEYWORDS = [
  "gym", "fitness", "restaurant", "hotel", "clinic", "hospital",
  "school", "retail", "property", "real estate", "construction",
  "manufacturing", "logistics", "transport", "hr", "payroll",
  "finance", "accounting", "inventory", "warehouse", "crm",
  "sales", "procurement", "facilities",
];

export function extractSectorKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  return SECTOR_KEYWORDS.find((w) => lower.includes(w)) ?? null;
}
