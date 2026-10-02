/**
 * TypeRegistry.js — Singleton PayanarssType Registry
 * ====================================================
 * Loads VanakkamPayanarssTypes.json ONCE at startup.
 * Builds O(1) lookup maps for all resolution needs.
 * Single source of truth for the entire server process.
 *
 * Usage:
 *   import registry from './TypeRegistry.js';
 *   const name = registry.getName('GYMSEG000000000000000000001001'); // "Bodybuilders"
 *   const children = registry.getChildren('mn8mlohmr73qpjffvsk');
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── PayanarssTypeId constants ────────────────────────────────
const PT = {
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
};

class TypeRegistry {
  constructor() {
    /** @type {Map<string, object>} Id → full node */
    this._byId = new Map();

    /** @type {Map<string, object[]>} parentId → children[] */
    this._byParent = new Map();

    /** @type {Map<string, string>} LookupValueType Id → Name */
    this._lookupMap = new Map();

    /** @type {Map<string, object[]>} LookupType Id → LookupValueType children[] */
    this._lookupOptions = new Map();

    this._loadedAt = null;
    this._filePath = null;
  }

  // ─── Initialise ─────────────────────────────────────────────

  /**
   * Load and index VanakkamPayanarssTypes.json.
   * Call once at server startup. Safe to call again to reload.
   * @param {string} filePath — absolute path to the JSON file
   */
  load(filePath) {
    this._filePath = filePath;
    console.log(`[TypeRegistry] Loading ${filePath} ...`);

    const raw = fs.readFileSync(filePath, 'utf8');
    const nodes = JSON.parse(raw);

    // Reset maps
    this._byId.clear();
    this._byParent.clear();
    this._lookupMap.clear();
    this._lookupOptions.clear();

    // Build byId and byParent
    for (const node of nodes) {
      this._byId.set(node.Id, node);
      if (node.Id !== node.ParentId) {
        if (!this._byParent.has(node.ParentId)) {
          this._byParent.set(node.ParentId, []);
        }
        this._byParent.get(node.ParentId).push(node);
      }
    }

    // Build lookupMap: LookupValueType Id → Name
    // Build lookupOptions: LookupType Id → LookupValueType children
    for (const node of nodes) {
      if (node.PayanarssTypeId === PT.LookupValueType) {
        // Id → display Name
        this._lookupMap.set(node.Id, node.Name);
        // Group by parent (the LookupType node)
        if (!this._lookupOptions.has(node.ParentId)) {
          this._lookupOptions.set(node.ParentId, []);
        }
        this._lookupOptions.get(node.ParentId).push(node);
      }
    }

    this._loadedAt = new Date().toISOString();

    console.log(`[TypeRegistry] ✅ Loaded ${nodes.length} nodes`);
    console.log(`[TypeRegistry]    LookupValueType entries: ${this._lookupMap.size}`);
    console.log(`[TypeRegistry]    LookupType groups: ${this._lookupOptions.size}`);
    console.log(`[TypeRegistry]    Loaded at: ${this._loadedAt}`);
  }

  /**
   * Reload from the same file (e.g. after designer updates).
   */
  reload() {
    if (!this._filePath) throw new Error('TypeRegistry not initialised — call load() first');
    this.load(this._filePath);
  }

  // ─── Core lookups ────────────────────────────────────────────

  /**
   * Get a node by Id.
   * @param {string} id
   * @returns {object|undefined}
   */
  getNode(id) {
    return this._byId.get(id);
  }

  /**
   * Get the display Name for any node Id.
   * @param {string} id
   * @returns {string}
   */
  getName(id) {
    return this._byId.get(id)?.Name ?? `⚠ ${id.slice(0, 12)}...`;
  }

  /**
   * Resolve a LookupValueType Id → display Name.
   * This is the primary method for rendering stored lookup values.
   * @param {string} lookupValueId — stored Id (e.g. "GYMSEG000000000000000000001001")
   * @returns {string} — display Name (e.g. "Bodybuilders") or fallback
   */
  resolveLookup(lookupValueId) {
    if (!lookupValueId) return '';
    const name = this._lookupMap.get(lookupValueId);
    return name ?? `⚠ Unknown (${lookupValueId.slice(0, 12)}...)`;
  }

  /**
   * Get the valid options for a LookupType field.
   * @param {string} lookupTypeId — the PayanarssTypeId of the column (points to a LookupType node)
   * @returns {{ Id: string, Name: string, Description: string|null }[]}
   */
  getLookupOptions(lookupTypeId) {
    // Direct children of the LookupType node
    const direct = this._lookupOptions.get(lookupTypeId) ?? [];
    if (direct.length > 0) return direct;

    // The column's PayanarssTypeId might point to a node whose own PayanarssTypeId = LookupType
    // Resolve one level: col.PayanarssTypeId → node → node.Id as LookupType parent
    const refNode = this._byId.get(lookupTypeId);
    if (refNode?.PayanarssTypeId === PT.LookupType) {
      return this._lookupOptions.get(refNode.Id) ?? [];
    }
    return [];
  }

  /**
   * Get all direct children of a node.
   * @param {string} parentId
   * @returns {object[]}
   */
  getChildren(parentId) {
    return this._byParent.get(parentId) ?? [];
  }

  /**
   * Get all descendants of a node (full subtree).
   * @param {string} rootId
   * @returns {object[]}
   */
  getDescendants(rootId) {
    const results = [];
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift();
      const children = this._byParent.get(id) ?? [];
      for (const child of children) {
        results.push(child);
        queue.push(child.Id);
      }
    }
    return results;
  }

  /**
   * Check if a value is a valid LookupValueType Id.
   * @param {string} value
   * @returns {boolean}
   */
  isLookupValueId(value) {
    return this._lookupMap.has(value);
  }

  /**
   * Resolve all lookup fields in a data record.
   * Returns a new object with Id-based values AND their resolved names.
   * @param {Record<string, string>} data — raw stored data (colId → stored value)
   * @param {object[]} columns — column nodes for this table
   * @returns {Record<string, { id: string, display: string }>}
   */
  resolveRecord(data, columns) {
    const resolved = {};
    for (const col of columns) {
      const storedValue = data[col.Id] ?? '';
      if (this._lookupMap.has(storedValue)) {
        resolved[col.Name] = {
          id: storedValue,
          display: this._lookupMap.get(storedValue),
        };
      } else {
        resolved[col.Name] = {
          id: storedValue,
          display: storedValue,
        };
      }
    }
    return resolved;
  }

  // ─── Status ──────────────────────────────────────────────────

  get status() {
    return {
      loaded: !!this._loadedAt,
      loadedAt: this._loadedAt,
      totalNodes: this._byId.size,
      lookupValues: this._lookupMap.size,
      lookupGroups: this._lookupOptions.size,
    };
  }

  /** Expose lookup map for segment detection in query routes */
  get lookupMap() { return this._lookupMap; }
}

// ─── Export singleton ─────────────────────────────────────────
// One instance, shared across all modules in the server process.
const registry = new TypeRegistry();
export default registry;
export { PT };
