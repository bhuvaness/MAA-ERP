/**
 * PayanarssType Data Service
 * ==========================
 * Abstracts data access so the app doesn't know (or care) whether
 * data comes from a static JSON file or a REST API.
 *
 * CURRENT:  Static JSON from public/data/VanakkamPayanarssTypes.json
 * FUTURE:   Replace fetchAllTypes() body with REST call — zero refactoring needed.
 *
 * Architecture:
 *   Component → useBusinessSetup hook → payanarssTypeService → data source
 *                                                              ↑
 *                                                    (swap this layer only)
 */

import type { PayanarssType } from "../types/PayanarssType";
import { TYPE_IDS } from "../types/PayanarssType";

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION — Change this ONE line when switching to REST API
// ═══════════════════════════════════════════════════════════════

const DATA_SOURCE = "/data/VanakkamPayanarssTypes.json"; // Static file
// const DATA_SOURCE = "https://api.maaerp.com/v1/payanarss-types"; // REST API (future)

// ═══════════════════════════════════════════════════════════════
// SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface PayanarssTypeService {
  /** Fetch all PayanarssType nodes (flat array) */
  fetchAllTypes(): Promise<PayanarssType[]>;

  /** Fetch children of a specific node (for lazy-loading in future) */
  fetchChildren(parentId: string): Promise<PayanarssType[]>;

  /** Save user's selected business configuration */
  saveBusinessConfig(selectedIds: string[]): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// IMPLEMENTATION — Static JSON (current)
// ═══════════════════════════════════════════════════════════════

/** In-memory cache to avoid re-fetching */
let cachedTypes: PayanarssType[] | null = null;

/**
 * Fetches all PayanarssType nodes.
 *
 * Current: Loads from static JSON file in public/data/
 * Future:  Replace fetch URL with REST endpoint. Response format
 *          is identical (flat JSON array), so no parsing changes needed.
 */
export async function fetchAllTypes(): Promise<PayanarssType[]> {
  if (cachedTypes) return cachedTypes;

  const response = await fetch(DATA_SOURCE);
  if (!response.ok) {
    throw new Error(`Failed to load PayanarssTypes: ${response.status} ${response.statusText}`);
  }

  const data: PayanarssType[] = await response.json();

  // Validate minimum structure
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("PayanarssTypes data is empty or invalid");
  }

  cachedTypes = data;
  console.log(`📦 Loaded ${data.length} PayanarssTypes from ${DATA_SOURCE}`);
  return data;
}

/**
 * Fetches children of a specific parent.
 *
 * Current: Filters from cached flat array (already loaded).
 * Future:  Could be a dedicated REST endpoint for lazy-loading:
 *          GET /api/payanarss-types?parentId={parentId}
 */
export async function fetchChildren(parentId: string): Promise<PayanarssType[]> {
  const all = await fetchAllTypes();
  return all.filter(
    (t) => t.ParentId === parentId && t.Id !== t.ParentId
  );
}

/**
 * Saves the user's business configuration (selected industries, modules, etc.)
 *
 * Current: Stores in localStorage.
 * Future:  POST /api/business-config { userId, selectedTypeIds }
 */
export async function saveBusinessConfig(selectedIds: string[]): Promise<void> {
  // FUTURE: Replace with REST API call
  // await fetch(`${API_BASE}/business-config`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ selectedTypeIds: selectedIds }),
  // });

  localStorage.setItem("maa-erp-business-config", JSON.stringify({
    selectedTypeIds: selectedIds,
    configuredAt: new Date().toISOString(),
  }));

  console.log(`💾 Saved business config: ${selectedIds.length} selections`);
}

/**
 * Loads previously saved business configuration.
 */
export async function loadBusinessConfig(): Promise<string[] | null> {
  // FUTURE: GET /api/business-config
  const stored = localStorage.getItem("maa-erp-business-config");
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    return parsed.selectedTypeIds || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS DISCOVERY
// ═══════════════════════════════════════════════════════════════

/**
 * Find business-related GroupType nodes by name (case-insensitive partial match).
 * Example: findBusinessByName("Gym") → ["Gym & Fitness Center"]
 */
export async function findBusinessByName(query: string): Promise<PayanarssType[]> {
  const all = await fetchAllTypes();
  const lower = query.toLowerCase();
  return all.filter(t =>
    t.Name.toLowerCase().includes(lower) &&
    t.PayanarssTypeId === TYPE_IDS.GROUP_TYPE
  );
}

/**
 * Given a business sub-sector node (like "Gym & Fitness Center"),
 * find its child GroupType node that represents the DB Schema.
 */
export async function getBusinessSchemaRoot(sectorId: string): Promise<PayanarssType | null> {
  const children = await fetchChildren(sectorId);
  return children.find(c => c.PayanarssTypeId === TYPE_IDS.GROUP_TYPE) || children[0] || null;
}

/** Clear the in-memory cache (useful after data updates) */
export function clearCache(): void {
  cachedTypes = null;
}
