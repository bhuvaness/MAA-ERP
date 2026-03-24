/**
 * ptSearchService.ts
 * ==================
 * POC: calls /api/claude-match (Express → Claude API with real catalog).
 *
 * ARCHITECTURE (enforced by server.js):
 *   1. Express loads VanakkamPayanarssTypes.json at startup
 *   2. Sends navigable catalog (Modules/UseCases/Groups/Solutions) to Claude
 *   3. Claude returns ONLY matchedIds from that catalog — no hallucination
 *   4. Express validates IDs exist before returning
 *   5. THIS file hydrates matchedIds from local JSON for display
 */

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

const EXPRESS_API: string =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_EXPRESS_API ?? 'http://localhost:3001/api';

// ─── Cache ────────────────────────────────────────────────────
let _allTypes: PTNode[] | null = null;

async function loadAllTypes(): Promise<PTNode[]> {
  if (_allTypes) return _allTypes;
  const res = await fetch('/data/VanakkamPayanarssTypes.json');
  if (!res.ok) throw new Error('Failed to load VanakkamPayanarssTypes.json');
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

/**
 * Resolve typeName from PayanarssTypeId.
 * IMPORTANT: Check longest suffix FIRST (most specific → least specific).
 * endsWith('111') also matches '1111' and '11111', so order matters.
 */
function resolveTypeName(typeId: string): string {
  if (typeId.endsWith('11111')) return 'Business Solution';
  if (typeId.endsWith('1111'))  return 'Business Module';
  if (typeId.endsWith('111'))   return 'Use Case';
  if (typeId.endsWith('4'))     return 'Group';
  if (typeId.endsWith('2'))     return 'Table';
  return 'Module';
}

// ─── Main search — calls Express → Claude with real catalog ───
export async function searchModules(keyword: string): Promise<ModuleResult[]> {
  console.log('[ptSearch] Calling /api/claude-match for:', keyword);

  let matchedIds: string[];
  let summary: string;

  try {
    const res = await fetch(`${EXPRESS_API}/claude-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: keyword }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    const json = await res.json();
    matchedIds = json.matchedIds ?? [];
    summary    = json.summary ?? '';

    // Log validation stats from server
    if (json.stats) {
      console.log(`[ptSearch] Server stats: ${json.stats.valid} valid, ${json.stats.rejected} rejected hallucinations`);
    }
    console.log(`[ptSearch] Claude matched ${matchedIds.length} valid IDs`);
  } catch (err) {
    console.error('[ptSearch] Claude match failed:', (err as Error).message);
    throw new Error(`Search failed: ${(err as Error).message}`);
  }

  if (matchedIds.length === 0) return [];

  // Hydrate from local JSON — ONLY real IDs from our catalog
  const allNodes = await loadAllTypes();
  const idMap    = buildIdMap(allNodes);
  const results: ModuleResult[] = [];

  for (const id of matchedIds) {
    const node = idMap.get(id);
    if (!node) {
      // Double safety: skip any ID not in local data
      console.warn(`[ptSearch] ID ${id} not found in local JSON — skipping`);
      continue;
    }

    const parent = node.Id !== node.ParentId ? idMap.get(node.ParentId) : null;

    results.push({
      id:             node.Id,
      name:           node.Name,
      description:    node.Description ?? '',
      typeId:         node.PayanarssTypeId,
      typeName:       resolveTypeName(node.PayanarssTypeId),
      parentName:     parent?.Name ?? null,
      childCount:     countChildren(node.Id, allNodes),
      path:           getAncestorPath(node.Id, idMap),
      relevanceScore: '1.0',
      reason:         summary,
      matchedFields:  ['name'],
    });
  }

  console.log(`[ptSearch] Hydrated ${results.length} modules from local JSON`);
  return results;
}

// ─── Get children ─────────────────────────────────────────────
export async function getModuleChildren(parentId: string): Promise<PTNode[]> {
  const allNodes = await loadAllTypes();
  return allNodes.filter((n) => n.ParentId === parentId && n.Id !== parentId);
}

// ─── Sector keyword extractor ─────────────────────────────────
const SECTOR_KEYWORDS = [
  'gym', 'fitness', 'restaurant', 'hotel', 'clinic', 'hospital',
  'school', 'retail', 'property', 'real estate', 'construction',
  'manufacturing', 'logistics', 'transport', 'hr', 'payroll',
  'finance', 'accounting', 'inventory', 'warehouse', 'crm',
  'sales', 'procurement', 'facilities', 'sports', 'recreation',
  'pest control', 'cleaning', 'laundry', 'salon', 'spa',
];

export function extractSectorKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  return SECTOR_KEYWORDS.find((w) => lower.includes(w)) ?? null;
}
