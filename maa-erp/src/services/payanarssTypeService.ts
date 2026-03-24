import type { PayanarssType } from "../types/core";

const DATA_SOURCE = "/data/VanakkamPayanarssTypes.json";
let cachedTypes: PayanarssType[] | null = null;

export async function fetchAllTypes(): Promise<PayanarssType[]> {
  if (cachedTypes) return cachedTypes;
  const response = await fetch(DATA_SOURCE);
  if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
  const data: PayanarssType[] = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("Empty data");
  cachedTypes = data;
  console.log(`Loaded ${data.length} PayanarssTypes`);
  return data;
}

export async function fetchChildren(parentId: string): Promise<PayanarssType[]> {
  const all = await fetchAllTypes();
  return all.filter((t) => t.ParentId === parentId && t.Id !== t.ParentId);
}

export async function saveBusinessConfig(selectedIds: string[]): Promise<void> {
  localStorage.setItem("maa-erp-business-config", JSON.stringify({ selectedTypeIds: selectedIds }));
}

export async function loadBusinessConfig(): Promise<string[] | null> {
  const stored = localStorage.getItem("maa-erp-business-config");
  if (!stored) return null;
  try { return JSON.parse(stored).selectedTypeIds || null; } catch { return null; }
}

export function clearCache(): void { cachedTypes = null; }
