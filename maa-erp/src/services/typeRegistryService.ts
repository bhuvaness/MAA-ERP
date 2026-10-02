/**
 * typeRegistryService.ts — Frontend TypeRegistry Client
 * ======================================================
 * Mirrors the server-side TypeRegistry on the client.
 *
 * Architecture:
 *   1. On first call, fetch /data/VanakkamPayanarssTypes.json once
 *   2. Build the same O(1) maps client-side
 *   3. All resolution is synchronous after the first load
 *   4. Expose a React hook for components to consume
 *
 * This is the single source of truth for ALL lookup resolution in the UI.
 */

import type { PayanarssType } from '../types/core';

// ─── PayanarssTypeId constants ────────────────────────────────

export const PT = {
  LookupValueType: '1000000000000000000000000000000031',
  LookupType:      '100000000000000000000000000000003',
  TableType:       '100000000000000000000000000000001',
  ChildTable:      '100000000000000000000000000000002',
  GroupType:       '100000000000000000000000000000004',
  Text:            '100000000000000000000000000000006',
  Number:          '100000000000000000000000000000007',
  DateTime:        '100000000000000000000000000000008',
  Boolean:         '100000000000000000000000000000009',
  Blob:            '100000000000000000000000000000010',
  GUID:            '100000000000000000000000000000011',
} as const;

// ─── TypeRegistry class ───────────────────────────────────────

class TypeRegistry {
  private _byId = new Map<string, PayanarssType>();
  private _byParent = new Map<string, PayanarssType[]>();
  private _lookupMap = new Map<string, string>(); // Id → Name
  private _lookupOptions = new Map<string, PayanarssType[]>(); // LookupType Id → options
  private _loadPromise: Promise<void> | null = null;
  private _loaded = false;

  // ─── Load ──────────────────────────────────────────────────

  load(): Promise<void> {
    if (this._loaded) return Promise.resolve();
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = fetch('/data/VanakkamPayanarssTypes.json')
      .then(r => r.json())
      .then((nodes: PayanarssType[]) => {
        this._byId.clear();
        this._byParent.clear();
        this._lookupMap.clear();
        this._lookupOptions.clear();

        for (const node of nodes) {
          this._byId.set(node.Id, node);
          if (node.Id !== node.ParentId) {
            const siblings = this._byParent.get(node.ParentId) ?? [];
            siblings.push(node);
            this._byParent.set(node.ParentId, siblings);
          }
        }

        for (const node of nodes) {
          if (node.PayanarssTypeId === PT.LookupValueType) {
            this._lookupMap.set(node.Id, node.Name);
            const opts = this._lookupOptions.get(node.ParentId) ?? [];
            opts.push(node);
            this._lookupOptions.set(node.ParentId, opts);
          }
        }

        this._loaded = true;
        console.log(`[TypeRegistry] Loaded ${nodes.length} nodes, ${this._lookupMap.size} lookup values`);
      });

    return this._loadPromise;
  }

  // ─── Core resolution ───────────────────────────────────────

  getNode(id: string): PayanarssType | undefined {
    return this._byId.get(id);
  }

  getName(id: string): string {
    return this._byId.get(id)?.Name ?? `⚠ ${id.slice(0, 12)}...`;
  }

  /**
   * THE KEY METHOD — resolve a stored LookupValueType Id → display Name.
   * Called whenever a lookup value needs to be shown in the UI.
   *
   * @param storedId - "GYMSEG000000000000000000001001"
   * @returns        - "Bodybuilders"
   */
  resolveLookup(storedId: string): string {
    if (!storedId) return '';
    const name = this._lookupMap.get(storedId);
    return name ?? `⚠ Unknown (${storedId.slice(0, 12)}...)`;
  }

  /**
   * Check if a value is a registered LookupValueType Id.
   * Used in edit-mode to identify stored lookup values.
   */
  isLookupValueId(value: string): boolean {
    return this._lookupMap.has(value);
  }

  /**
   * Get dropdown options for a lookup column.
   * @param colPayanarssTypeId - the column's PayanarssTypeId (points to a LookupType node)
   * @returns array of { Id, Name } for <option> rendering
   */
  getLookupOptions(colPayanarssTypeId: string): { id: string; name: string }[] {
    // Direct: col.PayanarssTypeId is the LookupType node Id
    const direct = this._lookupOptions.get(colPayanarssTypeId);
    if (direct?.length) return direct.map(n => ({ id: n.Id, name: n.Name }));

    // Indirect: col.PayanarssTypeId → node → node.Id as LookupType parent
    const refNode = this._byId.get(colPayanarssTypeId);
    if (refNode?.PayanarssTypeId === PT.LookupType) {
      return (this._lookupOptions.get(refNode.Id) ?? [])
        .map(n => ({ id: n.Id, name: n.Name }));
    }

    return [];
  }

  getChildren(parentId: string): PayanarssType[] {
    return this._byParent.get(parentId) ?? [];
  }

  getAllTypes(): PayanarssType[] {
    return Array.from(this._byId.values());
  }

  get isLoaded(): boolean { return this._loaded; }
}

// ─── Singleton export ─────────────────────────────────────────
export const typeRegistry = new TypeRegistry();

// ─── React hook ───────────────────────────────────────────────

import { useState, useEffect } from 'react';

/**
 * useTypeRegistry — React hook for consuming the TypeRegistry.
 * Triggers the one-time load and returns the registry when ready.
 */
export function useTypeRegistry() {
  const [ready, setReady] = useState(typeRegistry.isLoaded);

  useEffect(() => {
    if (!ready) {
      typeRegistry.load().then(() => setReady(true));
    }
  }, []);

  return { registry: typeRegistry, ready };
}
