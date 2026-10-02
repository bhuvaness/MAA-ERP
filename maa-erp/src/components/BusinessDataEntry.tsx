/**
 * BusinessDataEntry.tsx
 * =====================
 * Navigates the real PayanarssType hierarchy for data entry.
 *
 * Flow:
 *   Phase (BUC) → child USE CASEs → child TABLEs → DynamicForm (columns)
 *
 * Each level is discovered dynamically from VanakkamPayanarssTypes.json.
 * Records are persisted in localStorage keyed by tableId.
 * Full CRUD: Create, Read (list), Update (edit), Delete.
 *
 * Props:
 *   phaseId  — the root BUC node to enter (e.g. "Register Business")
 *   onClose  — called when user exits back to chat
 */

import React, {
  useState, useEffect, useMemo, useCallback,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { fetchAllTypes } from '../services/payanarssTypeService';
import type { PayanarssType } from '../types/core';
import { getUseCaseChildren, type UseCaseChild } from '../services/ptSearchService';
import { embedRecord } from '../services/transactionEmbedService';

// ─── API base ─────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_EXPRESS_API ?? 'http://localhost:3001/api';

// ─── PayanarssTypeId constants ────────────────────────────────

const PT = {
  BusinessUseCase:  '10000000000000000000000000000000111',
  BusinessModule:   '10000000000000000000000000000001111',
  BusinessSolution: '10000000000000000000000000000011111',
  TableType:        '100000000000000000000000000000001',
  ChildTable:       '100000000000000000000000000000002',
  LookupType:       '100000000000000000000000000000003',
  GroupType:        '100000000000000000000000000000004',
  AttributeType:    '100000000000000000000000000000005',
  Text:             '100000000000000000000000000000006',
  Number:           '100000000000000000000000000000007',
  DateTime:         '100000000000000000000000000000008',
  Boolean:          '100000000000000000000000000000009',
  Blob:             '100000000000000000000000000000010',
  ValueType:        '100000000000000000000000000000000', // generic — needs name inference
  LookupValueType:  '1000000000000000000000000000000031',
  GUID:             '100000000000000000000000000000011',
};

const COLUMN_TYPE_IDS = new Set([
  PT.ValueType, PT.GUID,
  PT.Text, PT.Number, PT.DateTime, PT.Boolean, PT.Blob, PT.LookupType,
]);

// ─── Field type inference ─────────────────────────────────────

type FieldKind = 'guid' | 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'blob' | 'lookup';

/**
 * Determine the UI control purely from PayanarssTypeId.
 * Also resolves custom LookupType references (e.g. CustomerSegmentTypes).
 * No name heuristics — the designer must set the correct type.
 */
function inferFieldKind(typeId: string, allTypes?: PayanarssType[]): FieldKind {
  switch (typeId) {
    case PT.GUID:       return 'guid';
    case PT.Text:       return 'text';
    case PT.Number:     return 'number';
    case PT.DateTime:   return 'date';
    case PT.Boolean:    return 'boolean';
    case PT.Blob:       return 'blob';
    case PT.LookupType: return 'lookup';
    default: {
      // Check if this typeId points to a node that is itself a LookupType
      // e.g. CustomerSegmentTypeName → PayanarssTypeId = CustomerSegmentTypes node ID
      //      CustomerSegmentTypes node → PayanarssTypeId = LookupType (...003)
      if (allTypes) {
        const refNode = allTypes.find(t => t.Id === typeId);
        if (refNode?.PayanarssTypeId === PT.LookupType) return 'lookup';
      }
      return 'text'; // ValueType or unknown → plain text
    }
  }
}

// Strict whitelist — only actual data entry structural nodes
const TABLE_TYPE_IDS = new Set([
  PT.TableType,   // ...001
  PT.ChildTable,  // ...002
  PT.LookupType,  // ...003 — LookupType nodes are data entry targets (e.g. CustomerSegmentTypes)
]);

function isDataNode(typeId: string): boolean {
  return TABLE_TYPE_IDS.has(typeId);
}

// ─── Record storage ───────────────────────────────────────────

interface StoredRecord {
  id: string;
  tableId: string;
  tableName: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, string>;
}

function storageKey(tableId: string) {
  return `maa-erp-data-${tableId}`;
}

function loadTableRecords(tableId: string): StoredRecord[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(tableId)) || '[]');
  } catch { return []; }
}

function saveTableRecords(tableId: string, records: StoredRecord[]) {
  localStorage.setItem(storageKey(tableId), JSON.stringify(records));
}

// ─── Helpers ─────────────────────────────────────────────────

function getChildren(allTypes: PayanarssType[], parentId: string) {
  return allTypes.filter(t => t.ParentId === parentId && t.Id !== parentId);
}

function parseLookupOptions(description: string | null): string[] {
  if (!description) return [];
  if (description.includes('/')) return description.split('/').map(s => s.trim()).filter(Boolean);
  if (description.includes(',')) return description.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

/**
 * Resolve a stored lookup value (Id) to its display name.
 * Falls back to the stored value if the node is not found.
 */
function resolveLookupDisplay(storedValue: string, allTypes: PayanarssType[]): string {
  if (!storedValue) return '';
  const node = allTypes.find(t => t.Id === storedValue);
  if (node) return node.Name;
  // Not found — node may have been deleted
  return `⚠ ${storedValue.slice(0, 8)}...`;
}

/**
 * Migrate a record's lookup fields from name-based to Id-based storage.
 * Safe to run on every load — skips fields already storing an Id.
 */
function migrateRecord(
  record: StoredRecord,
  columns: PayanarssType[],
  allTypes: PayanarssType[],
  PT: Record<string, string>
): StoredRecord {
  const migratedData = { ...record.data };
  let changed = false;
  for (const col of columns) {
    const storedValue = migratedData[col.Id] as string;
    if (!storedValue) continue;
    // Check if already an Id
    const isId = allTypes.some(t => t.Id === storedValue);
    if (isId) continue;
    // Find matching LookupValueType node by name
    const matchingNode = allTypes.find(t =>
      t.ParentId === col.PayanarssTypeId &&
      t.PayanarssTypeId === PT.LookupValueType &&
      t.Name === storedValue
    );
    if (matchingNode) {
      migratedData[col.Id] = matchingNode.Id;
      changed = true;
      console.log(`[migrate] ${col.Name}: "${storedValue}" → "${matchingNode.Id}"`);
    }
  }
  return changed ? { ...record, data: migratedData } : record;
}

/**
 * Find LookupValueType siblings of a table node.
 * These are LookupValueType children of the table's parent (use case).
 * Used to populate dropdown options for any column in that table.
 */
function resolveSiblingLookupValues(
  allTypes: PayanarssType[],
  tableId: string
): string[] {
  const tableNode = allTypes.find(t => t.Id === tableId);
  if (!tableNode) return [];
  return getChildren(allTypes, tableNode.ParentId)
    .filter(c => c.PayanarssTypeId === PT.LookupValueType)
    .map(c => c.Name);
}

function isAutoField(name: string) {
  return ['CreatedBy', 'CreatedOn', 'ModifiedBy', 'ModifiedOn', 'CreatedAt', 'UpdatedAt'].includes(name);
}


// ─── Types ────────────────────────────────────────────────────

interface Props {
  phaseId: string;
  phaseName: string;
  onClose: () => void;
}

type ViewMode = 'phase' | 'usecase' | 'table-list' | 'form' | 'record-list' | 'record-detail';

interface NavState {
  mode: ViewMode;
  useCaseId?: string;
  useCaseName?: string;
  tableId?: string;
  tableName?: string;
  editingRecord?: StoredRecord;
}

// ─── Component ───────────────────────────────────────────────

const BusinessDataEntry: React.FC<Props> = ({ phaseId, phaseName, onClose }) => {
  const [allTypes, setAllTypes] = useState<PayanarssType[]>([]);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<NavState>({ mode: 'phase' });
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tableRecords, setTableRecords] = useState<StoredRecord[]>([]);
  // Pinecone embed state for record list
  const [embedStatus, setEmbedStatus] = useState<'idle' | 'embedding' | 'done' | 'error'>('idle');
  const [embedProgress, setEmbedProgress] = useState({ current: 0, total: 0 });

  // Pinecone-fetched children for the current use case
  const [pineconeChildren, setPineconeChildren] = useState<UseCaseChild[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  // Pinecone column names for current table (fallback when local JSON is stale)
  const [pineconeColumnNames, setPineconeColumnNames] = useState<string[]>([]);

  useEffect(() => {
    fetchAllTypes().then(types => {
      setAllTypes(types);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Derived: children of current phase ──
  const phaseChildren = useMemo(() => {
    if (!allTypes.length) return [];
    const direct = getChildren(allTypes, phaseId);
    // If direct children are all tables/columns → treat phase itself as the use case
    const hasBucChildren = direct.some(c => c.PayanarssTypeId === PT.BusinessUseCase);
    if (!hasBucChildren) return []; // handled in table-list mode
    return direct.filter(c => c.PayanarssTypeId === PT.BusinessUseCase);
  }, [allTypes, phaseId]);

  const phaseTables = useMemo(() => {
    if (!allTypes.length) return [];
    return getChildren(allTypes, phaseId).filter(c => isDataNode(c.PayanarssTypeId));
  }, [allTypes, phaseId]);

  const useCaseTables = useMemo(() => {
    if (!nav.useCaseId || !allTypes.length) return [];
    // Always source tables from local JSON — reliable, no timing issues
    return getChildren(allTypes, nav.useCaseId).filter(c => isDataNode(c.PayanarssTypeId));
  }, [allTypes, nav.useCaseId]);

  const currentTables = nav.useCaseId ? useCaseTables : phaseTables;

  // ── Auto-navigate if phase has no BUC children ──
  useEffect(() => {
    if (!loading && allTypes.length && nav.mode === 'phase') {
      if (phaseChildren.length === 0 && phaseTables.length > 0) {
        setNav({ mode: 'table-list' });
      } else if (phaseChildren.length === 0 && phaseTables.length === 0) {
        // Leaf phase with direct columns — treat phase as table
        setNav({ mode: 'table-list' });
      }
    }
  }, [loading, allTypes, nav.mode, phaseChildren, phaseTables]);

  // ── Table columns ──
  // A column is renderable if:
  //   a) Its PayanarssTypeId is a known scalar type (Text, Number, etc.)
  //   b) Its PayanarssTypeId resolves to a node that is itself a LookupType
  //      (handles custom lookup references like CustomerSegmentTypes)
  const columns = useMemo(() => {
    if (!nav.tableId || !allTypes.length) return [];
    const idToTypeId = new Map(allTypes.map(t => [t.Id, t.PayanarssTypeId]));
    const STRUCTURAL = new Set([
      PT.BusinessUseCase, PT.BusinessModule, PT.BusinessSolution,
      PT.TableType, PT.ChildTable, PT.GroupType, PT.AttributeType,
    ]);
    return getChildren(allTypes, nav.tableId)
      .filter(c => {
        if (isAutoField(c.Name)) return false;
        if (COLUMN_TYPE_IDS.has(c.PayanarssTypeId)) return true;
        // Check if PayanarssTypeId points to a LookupType node
        const resolvedTypeId = idToTypeId.get(c.PayanarssTypeId);
        if (resolvedTypeId === PT.LookupType) return true;
        // Exclude structural nodes, include everything else as text
        return !STRUCTURAL.has(c.PayanarssTypeId);
      });
  }, [allTypes, nav.tableId]);

  // ── Sibling lookup values (LookupValueType children of the use case) ──
  const siblingLookupValues = useMemo(() => {
    if (!nav.tableId || !allTypes.length) return [] as string[];
    return resolveSiblingLookupValues(allTypes, nav.tableId);
  }, [allTypes, nav.tableId]);

  // ── Global lookup map: LookupValueType Id → display Name ──────────────────
  // Built once from allTypes. Used to resolve stored Ids to display names.
  // Key:   LookupValueType node Id  (e.g. "GYMSEG000000000000000000001001")
  // Value: display Name             (e.g. "Bodybuilders")
  const lookupIdMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const t of allTypes) {
      if (t.PayanarssTypeId === PT.LookupValueType) {
        map.set(t.Id, t.Name);
      }
    }
    return map;
  }, [allTypes]);

  // Resolve a stored lookup Id to its display name using the map
  const resolveLookup = (storedId: string): string => {
    if (!storedId) return '';
    const name = lookupIdMap.get(storedId);
    if (name) return name;
    return `⚠ ${storedId.slice(0, 12)}...`; // deleted/unknown node
  };

  // ── Rules (GroupType children) ──
  const rules = useMemo(() => {
    if (!nav.tableId || !allTypes.length) return [] as string[];
    return getChildren(allTypes, nav.tableId)
      .filter(c => c.PayanarssTypeId === PT.GroupType)
      .map(c => c.Name);
  }, [allTypes, nav.tableId]);

  // ── Re-init form in edit mode ──
  // Wait for both columns AND lookupIdMap to be ready before calling initForm
  useEffect(() => {
    if (nav.mode !== 'form' || !nav.editingRecord || !columns.length || !allTypes.length) return;
    if (lookupIdMap.size === 0) return; // wait for lookupIdMap to populate
    initForm(columns, nav.editingRecord);
  }, [columns, nav.editingRecord?.id, nav.mode, lookupIdMap]);
  // Runs whenever formData or allTypes changes — fills any empty field
  // whose referenced type node resolves to GUID/UUID.
  useEffect(() => {
    if (nav.mode !== 'form' || !allTypes.length) return;
    const tableColumns = nav.tableId
      ? getChildren(allTypes, nav.tableId).filter(c => !isAutoField(c.Name))
      : [];
    let needsUpdate = false;
    const updated = { ...formData };
    for (const col of tableColumns) {
      if (updated[col.Id] && updated[col.Id] !== '') continue; // already filled
      const kind = inferFieldKind(col.PayanarssTypeId, allTypes);
      if (kind === 'guid') {
        updated[col.Id] = uuidv4();
        needsUpdate = true;
        continue;
      }
      // Check ref node name as fallback
      const refNode = allTypes.find(t => t.Id === col.PayanarssTypeId);
      const name = (refNode?.Name || '').toLowerCase();
      if (name === 'guid' || name === 'uuid') {
        updated[col.Id] = uuidv4();
        needsUpdate = true;
      }
    }
    if (needsUpdate) setFormData(updated);
  }, [nav.mode, nav.tableId, allTypes]);

  // ── Auto-open form when only one table (skip the list click) ──
  useEffect(() => {
    if (
      !loadingChildren &&
      nav.mode === 'table-list' &&
      currentTables.length === 1 &&
      allTypes.length > 0
    ) {
      openForm(currentTables[0]);
    }
  }, [loadingChildren, nav.mode, currentTables, allTypes]);
  useEffect(() => {
    if (nav.tableId && (nav.mode === 'record-list' || nav.mode === 'table-list')) {
      setTableRecords(loadTableRecords(nav.tableId));
    }
  }, [nav.tableId, nav.mode]);

  // ── Form init ──
  // UUID v4 regex for detection
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const initForm = useCallback((cols: PayanarssType[], existing?: StoredRecord) => {
    const init: Record<string, string> = {};
    for (const col of cols) {
      const kind = inferFieldKind(col.PayanarssTypeId, allTypes);
      const savedValue = existing?.data[col.Id];

      if (savedValue !== undefined) {
        init[col.Id] = savedValue as string;
      } else if (existing) {
        // col.Id changed after re-import — find value by type
        if (kind === 'lookup') {
          // Use lookupIdMap: O(1), works regardless of col.Id or JSON sync
          const found = Object.values(existing.data)
            .find(v => lookupIdMap.has(v as string));
          if (found) { init[col.Id] = found as string; continue; }
        }
        if (kind === 'boolean') {
          const found = Object.values(existing.data)
            .find(v => v === 'true' || v === 'false');
          if (found) { init[col.Id] = found as string; continue; }
        }
        if (kind === 'number') {
          const found = Object.values(existing.data)
            .find(v => typeof v === 'string' && !isNaN(Number(v as string)) && v !== '' && v !== 'true' && v !== 'false');
          if (found) { init[col.Id] = found as string; continue; }
        }
        // Default
        if (kind === 'guid') init[col.Id] = uuidv4();
        else if (kind === 'boolean') init[col.Id] = 'false';
        else init[col.Id] = '';
      } else {
        if (kind === 'guid') {
          init[col.Id] = uuidv4();
        } else if (kind === 'boolean') {
          init[col.Id] = 'false';
        } else {
          init[col.Id] = '';
        }
      }
    }
    // Second pass: auto-generate UUID for GUID columns with no value yet
    for (const col of cols) {
      if (init[col.Id] && init[col.Id] !== '') continue;
      const refNode = allTypes.find(t => t.Id === col.PayanarssTypeId);
      const typeName = (refNode?.Name || '').toLowerCase();
      if (typeName === 'guid' || typeName === 'uuid') {
        init[col.Id] = uuidv4();
      }
    }
    setFormData(init);
    setErrors({});
  }, [allTypes, lookupIdMap]);

  const openForm = useCallback((tableNode: PayanarssType, editing?: StoredRecord) => {
    setNav(prev => ({
      ...prev,
      mode: 'form',
      tableId: tableNode.Id,
      tableName: tableNode.Name,
      editingRecord: editing,
    }));

    const idToTypeId = new Map(allTypes.map(t => [t.Id, t.PayanarssTypeId]));
    const STRUCTURAL = new Set([
      PT.BusinessUseCase, PT.BusinessModule, PT.BusinessSolution,
      PT.TableType, PT.ChildTable, PT.GroupType, PT.AttributeType, PT.LookupValueType,
    ]);
    const cols = getChildren(allTypes, tableNode.Id)
      .filter(c => {
        if (isAutoField(c.Name)) return false;
        if (COLUMN_TYPE_IDS.has(c.PayanarssTypeId)) return true;
        const resolvedTypeId = idToTypeId.get(c.PayanarssTypeId);
        if (resolvedTypeId === PT.LookupType) return true;
        return !STRUCTURAL.has(c.PayanarssTypeId);
      });
    initForm(cols, editing);

    // Extract column names from Pinecone metadata for display fallback
    const pChild = pineconeChildren.find(c => c.id === tableNode.Id);
    if (pChild?.columnNames) {
      setPineconeColumnNames(
        pChild.columnNames.split(',').map(s => s.trim()).filter(Boolean)
      );
    } else {
      setPineconeColumnNames([]);
    }
  }, [allTypes, initForm, pineconeChildren]);

  const openRecordList = useCallback(async (tableNode: PayanarssType) => {
    setNav(prev => ({
      ...prev,
      mode: 'record-list',
      tableId: tableNode.Id,
      tableName: tableNode.Name,
    }));

    const cols = allTypes.length
      ? getChildren(allTypes, tableNode.Id).filter(c => !isAutoField(c.Name))
      : [];

    const applyMigration = (records: StoredRecord[]) =>
      cols.length ? records.map(r => migrateRecord(r, cols, allTypes, PT)) : records;

    // Try server first, fall back to localStorage
    try {
      const res = await fetch(`${API_BASE}/records/${encodeURIComponent(tableNode.Id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.records) {
          const migrated = applyMigration(json.records);
          setTableRecords(migrated);
          saveTableRecords(tableNode.Id, migrated);
          return;
        }
      }
    } catch { /* server unavailable */ }

    const local = applyMigration(loadTableRecords(tableNode.Id));
    setTableRecords(local);
  }, [allTypes]);

  // ── Validation ──
  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    for (const rule of rules) {
      if (rule.startsWith('REQUIRED:')) {
        const fieldName = rule.replace('REQUIRED:', '').replace('is mandatory', '').trim();
        const col = columns.find(c => c.Name === fieldName);
        if (col && !formData[col.Id]) errs[col.Id] = `${col.Name} is required`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [rules, columns, formData]);

  // ── Save record ──
  const handleSave = useCallback(async () => {
    if (!nav.tableId || !nav.tableName) return;
    if (!validate()) return;
    setSaving(true);

    const now = new Date().toISOString();
    const existing = nav.editingRecord;

    // Use the GUID column value as the record ID
    const guidCol = columns.find(c => {
      const kind = inferFieldKind(c.PayanarssTypeId, allTypes);
      if (kind === 'guid') return true;
      const refNode = allTypes.find(t => t.Id === c.PayanarssTypeId);
      return (refNode?.Name || '').toLowerCase() === 'guid';
    });
    const recordId = existing?.id || (guidCol ? formData[guidCol.Id] : null) || uuidv4();

    const payload = {
      tableId: nav.tableId,
      tableName: nav.tableName,
      recordId,
      data: { ...formData },
    };

    // ── Save to server (primary) ──────────────────────────────
    let serverSaved = false;
    try {
      const res = await fetch(`${API_BASE}/records/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        serverSaved = true;
        console.log(`[BusinessDataEntry] Saved to server: ${nav.tableName}/${recordId}`);
      } else {
        console.warn('[BusinessDataEntry] Server save failed, falling back to localStorage');
      }
    } catch (err) {
      console.warn('[BusinessDataEntry] Server unavailable, falling back to localStorage:', err);
    }

    // ── localStorage fallback ─────────────────────────────────
    const localRecords = loadTableRecords(nav.tableId);
    if (existing) {
      saveTableRecords(nav.tableId, localRecords.map(r =>
        r.id === recordId ? { ...r, updatedAt: now, data: { ...formData } } : r
      ));
    } else {
      saveTableRecords(nav.tableId, [...localRecords, {
        id: recordId,
        tableId: nav.tableId,
        tableName: nav.tableName,
        createdAt: now,
        updatedAt: now,
        data: { ...formData },
      }]);
    }

    setSaving(false);
    setSavedOk(true);
    setTimeout(() => {
      setSavedOk(false);
      const tableNode = allTypes.find(t => t.Id === nav.tableId);
      if (tableNode) openRecordList(tableNode);
      else setNav(p => ({ ...p, mode: 'table-list', editingRecord: undefined }));
    }, 800);
  }, [nav, formData, columns, allTypes, validate, openRecordList]);

  // ── Delete record ──
  const handleDelete = useCallback(async (recordId: string) => {
    if (!nav.tableId) return;
    // Server delete (fire and forget)
    try {
      await fetch(`${API_BASE}/records/${encodeURIComponent(nav.tableId)}/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[BusinessDataEntry] Server delete failed (non-fatal):', err);
    }
    // Always update localStorage
    const updated = loadTableRecords(nav.tableId).filter(r => r.id !== recordId);
    saveTableRecords(nav.tableId, updated);
    setTableRecords(updated);
    setDeleteConfirm(null);
    setNav(prev => ({ ...prev, mode: 'record-list' }));
  }, [nav.tableId]);

  const updateField = useCallback((colId: string, value: string) => {
    setFormData(prev => ({ ...prev, [colId]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[colId]; return n; });
  }, []);

  // ─── BREADCRUMB ────────────────────────────────────────────

  const Breadcrumb = () => {
    const crumbs: { label: string; onClick: () => void }[] = [
      { label: phaseName, onClick: () => setNav({ mode: phaseChildren.length > 0 ? 'phase' : 'table-list' }) },
    ];
    if (nav.useCaseName) crumbs.push({ label: nav.useCaseName, onClick: () => setNav(p => ({ ...p, mode: 'table-list', editingRecord: undefined })) });
    if (nav.tableName && (nav.mode === 'form' || nav.mode === 'record-list' || nav.mode === 'record-detail')) {
      crumbs.push({ label: nav.tableName, onClick: () => openRecordList({ Id: nav.tableId!, Name: nav.tableName!, ParentId: '', PayanarssTypeId: PT.TableType, Attributes: [], Description: null }) });
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span>›</span>}
            <button onClick={c.onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === crumbs.length - 1 ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 12, fontWeight: i === crumbs.length - 1 ? 600 : 400, padding: 0 }}>
              {c.label}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ─── SHARED HEADER ─────────────────────────────────────────

  const Header = ({ title, badge, badgeColor }: { title: string; badge?: string; badgeColor?: string }) => (
    <div className="form-card-header" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="form-card-dot" style={{ background: 'var(--accent)' }} />
          <h4 style={{ margin: 0 }}>{title}</h4>
          {badge && (
            <span className="form-card-badge" style={{ background: badgeColor ? `${badgeColor}20` : 'var(--accent-light)', color: badgeColor || 'var(--accent)' }}>
              {badge}
            </span>
          )}
        </div>
        <Breadcrumb />
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)', lineHeight: 1, padding: '0 4px' }}>✕</button>
    </div>
  );

  if (loading) {
    return (
      <div className="msg-form-card" style={{ maxWidth: 600, minHeight: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-tertiary)', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Loading...
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // PHASE VIEW — list of use cases under this phase
  // ─────────────────────────────────────────────────────────
  if (nav.mode === 'phase') {
    return (
      <div className="msg-form-card" style={{ maxWidth: 600 }}>
        <Header title={phaseName} badge={`${phaseChildren.length} USE CASES`} />
        <div className="form-card-body" style={{ gap: 8 }}>
          {phaseChildren.map(uc => {
            const tables = getChildren(allTypes, uc.Id).filter(c => isDataNode(c.PayanarssTypeId));
            const totalRecords = tables.reduce((sum, t) => sum + loadTableRecords(t.Id).length, 0);
            return (
              <button key={uc.Id}
                onClick={async () => {
                  // Navigate immediately, show loading state
                  console.log(`[BusinessDataEntry] Navigating to use case: ${uc.Name} (${uc.Id})`);
                  setNav({ mode: 'table-list', useCaseId: uc.Id, useCaseName: uc.Name });
                  setPineconeChildren([]);
                  setLoadingChildren(true);
                  try {
                    const children = await getUseCaseChildren(uc.Name, uc.Id);
                    console.log(`[BusinessDataEntry] Got ${children.length} children:`, children.map(c => c.name));
                    setPineconeChildren(children);
                  } catch (err) {
                    console.warn('[BusinessDataEntry] getUseCaseChildren failed:', err);
                    setPineconeChildren([]);
                  } finally {
                    setLoadingChildren(false);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '12px 14px', background: 'var(--bg-warm)', border: '1px solid var(--border)',
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>⚡</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{uc.Name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {tables.length} table{tables.length !== 1 ? 's' : ''}
                    {totalRecords > 0 && ` · ${totalRecords} record${totalRecords !== 1 ? 's' : ''}`}
                    {uc.Description && ` · ${uc.Description.slice(0, 60)}`}
                  </div>
                </div>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>›</span>
              </button>
            );
          })}
          {phaseChildren.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>No use cases found under this phase.</div>
          )}
        </div>
        <div className="form-card-footer">
          <button onClick={onClose} style={cancelStyle}>← Back to Business Assistant</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // TABLE LIST VIEW — tables under a use case or phase
  // ─────────────────────────────────────────────────────────
  if (nav.mode === 'table-list') {
    const tables = currentTables;
    console.log(`[BusinessDataEntry] table-list render: useCaseId=${nav.useCaseId}, allTypes.length=${allTypes.length}, tables=${tables.length}`);
    return (
      <div className="msg-form-card" style={{ maxWidth: 600 }}>
        <Header title={nav.useCaseName || phaseName} badge={loadingChildren ? 'LOADING...' : `${tables.length} TABLE${tables.length !== 1 ? 'S' : ''}`} badgeColor="var(--blue)" />
        <div className="form-card-body" style={{ gap: 8 }}>
          {loadingChildren ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, color: 'var(--text-tertiary)' }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Fetching from Pinecone...
            </div>
          ) : tables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
              No tables defined for this use case.
            </div>
          ) : (
            tables.map(table => {
              const records = loadTableRecords(table.Id);
              const colCount = getChildren(allTypes, table.Id).filter(c => COLUMN_TYPE_IDS.has(c.PayanarssTypeId)).length;
              // Enrich with Pinecone metadata if available
              const pChild = pineconeChildren.find(c => c.id === table.Id);
              const displayDesc = pChild?.description || table.Description || '';
              const displayCols = pChild?.columnNames
                ? pChild.columnNames.split(',').slice(0, 4).join(', ')
                : '';
              return (
                <div key={table.Id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-warm)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🗃️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{table.Name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {colCount} field{colCount !== 1 ? 's' : ''}
                      {records.length > 0 ? ` · ${records.length} record${records.length !== 1 ? 's' : ''}` : ' · No records yet'}
                      {displayCols && ` · ${displayCols}`}
                    </div>
                    {displayDesc && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayDesc.slice(0, 80)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {records.length > 0 && (
                      <button onClick={() => openRecordList(table)} style={smallBtnStyle('var(--green-light)', 'var(--green)')}>
                        📋 List
                      </button>
                    )}
                    <button onClick={() => openForm(table)} style={smallBtnStyle('var(--accent-light)', 'var(--accent)')}>
                      + Add
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="form-card-footer">
          <button onClick={() => {
            setNav({ mode: phaseChildren.length > 0 ? 'phase' : 'table-list' });
            setPineconeChildren([]);
          }} style={cancelStyle}>← Back</button>
          <button onClick={onClose} style={cancelStyle}>Close</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RECORD LIST VIEW — saved records for a table
  // ─────────────────────────────────────────────────────────
  if (nav.mode === 'record-list') {
    const table = allTypes.find(t => t.Id === nav.tableId);
    // Use first non-GUID column as display label
    const labelCol = columns.find(c => {
      const kind = inferFieldKind(c.PayanarssTypeId, allTypes);
      if (kind === 'guid') return false;
      const refNode = allTypes.find(t => t.Id === c.PayanarssTypeId);
      return (refNode?.Name || '').toLowerCase() !== 'guid';
    });
    const secondCols = columns
      .filter(c => c.Id !== labelCol?.Id)
      .filter(c => {
        const kind = inferFieldKind(c.PayanarssTypeId, allTypes);
        return kind !== 'guid';
      })
      .slice(0, 2);

    return (
      <div className="msg-form-card" style={{ maxWidth: 600 }}>
        <Header title={nav.tableName || 'Records'} badge={`${tableRecords.length} RECORD${tableRecords.length !== 1 ? 'S' : ''}`} badgeColor="var(--green)" />
        <div className="form-card-body" style={{ gap: 8 }}>
          {tableRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              No records yet. Click "+ Add" to create one.
            </div>
          ) : (
            tableRecords.map(rec => {
              const resolveDisplay = (col: PayanarssType, storedVal: string): string => {
                const kind = inferFieldKind(col.PayanarssTypeId, allTypes);
                // For lookup: resolve stored Id → display Name using the map
                if (kind === 'lookup' && storedVal) return resolveLookup(storedVal);
                if (kind === 'boolean') return storedVal === 'true' ? 'Yes' : 'No';
                return storedVal || '';
              };
              const primaryValue = labelCol
                ? resolveDisplay(labelCol, (rec.data[labelCol.Id] ?? '') as string)
                : '';
              const secondaryParts = secondCols
                .map(c => resolveDisplay(c, (rec.data[c.Id] ?? '') as string))
                .filter(Boolean);
              return (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-warm)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
                    {(primaryValue || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {primaryValue || `Record ${rec.id.slice(0, 6)}`}
                    </div>
                    {secondaryParts.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{secondaryParts.join(' · ')}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => table && openForm(table, rec)} style={iconBtnStyle('var(--blue-light)', 'var(--blue)')}>✏️</button>
                    <button onClick={() => setDeleteConfirm(rec.id)} style={iconBtnStyle('var(--red-light)', 'var(--red)')}>🗑</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="form-card-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="fc-save" onClick={() => table && openForm(table)}>+ Add New</button>
          <button onClick={() => setNav(p => ({ ...p, mode: 'table-list' }))} style={cancelStyle}>← Back</button>

          {/* Explicit Pinecone embed button for existing records */}
          {tableRecords.length > 0 && (
            <button
              disabled={embedStatus === 'embedding'}
              onClick={async () => {
                if (!nav.tableId || !nav.tableName || !allTypes.length) return;
                setEmbedStatus('embedding');
                setEmbedProgress({ current: 0, total: tableRecords.length });
                let succeeded = 0;
                for (let i = 0; i < tableRecords.length; i++) {
                  const rec = tableRecords[i];
                  setEmbedProgress({ current: i + 1, total: tableRecords.length });
                  try {
                    await embedRecord({
                      recordId:  rec.id,
                      tableId:   nav.tableId!,
                      tableName: nav.tableName!,
                      data:      rec.data as Record<string, string>,
                      allTypes,
                    });
                    succeeded++;
                  } catch (err) {
                    console.warn(`[Embed] Failed for ${rec.id}:`, err);
                  }
                }
                setEmbedStatus(succeeded === tableRecords.length ? 'done' : 'error');
                setTimeout(() => setEmbedStatus('idle'), 3000);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 8, border: 'none', cursor: embedStatus === 'embedding' ? 'wait' : 'pointer',
                background: embedStatus === 'done'
                  ? 'var(--green-light)' : embedStatus === 'error'
                  ? 'var(--red-light)' : embedStatus === 'embedding'
                  ? '#f3e8ff' : '#f3e8ff',
                color: embedStatus === 'done'
                  ? 'var(--green)' : embedStatus === 'error'
                  ? 'var(--red)' : '#7c3aed',
                marginLeft: 'auto',
              }}
            >
              {embedStatus === 'embedding' ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  {embedProgress.current}/{embedProgress.total} Embedding...
                </>
              ) : embedStatus === 'done' ? (
                <>✓ {tableRecords.length} Embedded</>
              ) : embedStatus === 'error' ? (
                <>⚠ Partial embed</>
              ) : (
                <>🔮 Embed to Pinecone ({tableRecords.length})</>
              )}
            </button>
          )}
        </div>

        {deleteConfirm && (
          <DeleteModal
            onConfirm={() => handleDelete(deleteConfirm)}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // FORM VIEW — add / edit record
  // ─────────────────────────────────────────────────────────
  if (nav.mode === 'form') {
    const isEdit = !!nav.editingRecord;
    const table = allTypes.find(t => t.Id === nav.tableId);

    return (
      <div className="msg-form-card" style={{
        maxWidth: 600,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 180px)',
        overflow: 'hidden',
      }}>
        <Header
          title={isEdit ? `Edit ${nav.tableName}` : `New ${nav.tableName}`}
          badge={`${columns.filter(c => inferFieldKind(c.PayanarssTypeId, allTypes) !== 'guid' && !((allTypes.find(t => t.Id === c.PayanarssTypeId)?.Name || '').toLowerCase() === 'guid')).length || pineconeColumnNames.filter(n => !isAutoField(n)).length} FIELDS`}
          badgeColor="var(--accent)"
        />
        {/* Show auto-generated ID in sub-header */}
        {(() => {
          const idCol = columns.find(c => {
            const kind = inferFieldKind(c.PayanarssTypeId, allTypes);
            if (kind === 'guid') return true;
            const refNode = allTypes.find(t => t.Id === c.PayanarssTypeId);
            return (refNode?.Name || '').toLowerCase() === 'guid';
          });
          const idValue = idCol ? formData[idCol.Id] : '';
          if (!idValue) return null;
          return (
            <div style={{
              padding: '6px 16px 8px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--green-light)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {idCol!.Name}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--green)', letterSpacing: 0.3 }}>
                {idValue}
              </span>
            </div>
          );
        })()}
        <div className="form-card-body" style={{
          overflowY: 'auto',
          flex: 1,
          paddingBottom: 8,
        }}>
          {columns.length === 0 && pineconeColumnNames.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              No fields defined for this table.
            </div>
          )}

          {/* Render from local JSON columns using inferFieldKind — skip GUID (shown in header) */}
          {columns.length > 0 && columns
            .filter(col => inferFieldKind(col.PayanarssTypeId, allTypes) !== 'guid' &&
              !((allTypes.find(t => t.Id === col.PayanarssTypeId)?.Name || '').toLowerCase() === 'guid'))
            .map(col => {
            const kind = inferFieldKind(col.PayanarssTypeId, allTypes);
            const value = formData[col.Id] ?? '';
            const err = errors[col.Id];
            const isRequired = rules.some(r =>
              r.includes(`REQUIRED: ${col.Name}`) || r === `${col.Name} is mandatory`
            );
            const descOpts = parseLookupOptions(col.Description);
            const opts = descOpts.length > 0 ? descOpts : siblingLookupValues;

            return (
              <div key={col.Id} className="fc-field">
                <label className="fc-label">
                  {col.Name}
                  {isRequired && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
                  {(kind === 'guid' || (kind === 'text' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))) && (
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>AUTO</span>
                  )}
                  {col.Description && kind !== 'lookup' && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 6 }}>
                      {col.Description.slice(0, 50)}
                    </span>
                  )}
                </label>

                {/* GUID — show readonly green for explicit GUID kind OR UUID-format value */}
                {(kind === 'guid' || (kind === 'text' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))) && (
                  <input className="fc-input" type="text" value={value} readOnly
                    style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-light)', fontFamily: 'monospace', fontSize: 11 }}
                  />
                )}
                {kind === 'text' && !(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) && (
                  <input className="fc-input" type="text" value={value}
                    placeholder={col.Description || `Enter ${col.Name}`}
                    onChange={e => updateField(col.Id, e.target.value)}
                    style={err ? { borderColor: 'var(--red)' } : {}}
                  />
                )}
                {kind === 'number' && (
                  <input className="fc-input" type="number" value={value} step="any"
                    placeholder="0"
                    onChange={e => updateField(col.Id, e.target.value)}
                    style={err ? { borderColor: 'var(--red)' } : {}}
                  />
                )}
                {kind === 'date' && (
                  <input className="fc-input" type="date" value={value}
                    onChange={e => updateField(col.Id, e.target.value)}
                    style={err ? { borderColor: 'var(--red)' } : {}}
                  />
                )}
                {kind === 'datetime' && (
                  <input className="fc-input" type="datetime-local" value={value}
                    onChange={e => updateField(col.Id, e.target.value)}
                    style={err ? { borderColor: 'var(--red)' } : {}}
                  />
                )}

                {kind === 'boolean' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div onClick={() => updateField(col.Id, value === 'true' ? 'false' : 'true')}
                      style={{ width: 42, height: 22, borderRadius: 11, cursor: 'pointer',
                        background: value === 'true' ? 'var(--accent)' : 'var(--border)',
                        position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s', left: value === 'true' ? 22 : 2 }} />
                    </div>
                    <span style={{ fontSize: 12, color: value === 'true' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                      {value === 'true' ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
                {kind === 'blob' && (
                  <div style={{ position: 'relative' }}>
                    <input type="file" onChange={e => updateField(col.Id, e.target.files?.[0]?.name || '')}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
                    <div className="fc-input" style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', borderStyle: 'dashed', cursor: 'pointer' }}>
                      {value ? `📎 ${value}` : `📎 Upload ${col.Description || col.Name}`}
                    </div>
                  </div>
                )}
                {kind === 'lookup' && (() => {
                  // Get all LookupValueType children of the referenced LookupType node
                  const lookupNodes = allTypes.filter(t =>
                    t.ParentId === col.PayanarssTypeId &&
                    t.PayanarssTypeId === PT.LookupValueType
                  );

                  // value is the stored LookupValueType Id (e.g. "GYMSEG...001")
                  // resolveLookup() maps it to display name (e.g. "Bodybuilders")
                  // The <select> value attribute uses the Id directly for binding

                  if (lookupNodes.length > 0) {
                    return (
                      <select className="fc-input" value={value}
                        onChange={e => updateField(col.Id, e.target.value)}
                        style={err ? { borderColor: 'var(--red)' } : {}}
                      >
                        <option value="">Select {col.Name}...</option>
                        {lookupNodes.map(node => (
                          // value = stable LookupValueType Id (stored)
                          // text  = display Name (resolved at render time)
                          <option key={node.Id} value={node.Id}>{node.Name}</option>
                        ))}
                      </select>
                    );
                  }

                  // Fallback: description-based plain string options
                  const descOpts = parseLookupOptions(col.Description);
                  if (descOpts.length > 0) {
                    return (
                      <select className="fc-input" value={value}
                        onChange={e => updateField(col.Id, e.target.value)}
                        style={err ? { borderColor: 'var(--red)' } : {}}
                      >
                        <option value="">Select {col.Name}...</option>
                        {descOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    );
                  }

                  // Last resort: free text
                  return (
                    <input className="fc-input" type="text" value={value}
                      placeholder={col.Description || `Select ${col.Name}`}
                      onChange={e => updateField(col.Id, e.target.value)}
                      style={err ? { borderColor: 'var(--red)' } : {}}
                    />
                  );
                })()}

                {err && <span style={{ fontSize: 11, color: 'var(--red)' }}>{err}</span>}
              </div>
            );
          })}

          {/* Fallback: render text fields from Pinecone column_names when local JSON has no columns */}
          {columns.length === 0 && pineconeColumnNames.length > 0 && (
            <>
              <div style={{
                fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0 8px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>⚠️</span>
                Fields sourced from Pinecone — update local JSON for full type support
              </div>
              {pineconeColumnNames
                .filter(name => !isAutoField(name))
                .map(name => {
                  const fieldKey = `__pinecone_${name}`;
                  const value = formData[fieldKey] ?? '';
                  return (
                    <div key={name} className="fc-field">
                      <label className="fc-label">{name}</label>
                      <input
                        className="fc-input"
                        type="text"
                        value={value}
                        placeholder={`Enter ${name}`}
                        onChange={e => updateField(fieldKey, e.target.value)}
                      />
                    </div>
                  );
                })}
            </>
          )}
        </div>

        <div className="form-card-footer" style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          {savedOk ? (
            <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>✓ Saved!</span>
          ) : (
            <button className="fc-save" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : isEdit ? '✓ Update' : 'Save Record'}
            </button>
          )}
          <button onClick={() => {
            const tableNode = allTypes.find(t => t.Id === nav.tableId);
            if (tableNode) openRecordList(tableNode);
            else setNav(p => ({ ...p, mode: 'table-list' }));
          }} style={cancelStyle}>
            Cancel
          </button>
          <span className="fc-autosave"><span className="fc-autosave-dot" />Saves locally</span>
        </div>
      </div>
    );
  }

  return null;
};

// ─── Delete modal ─────────────────────────────────────────────

const DeleteModal: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: 300, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🗑</div>
      <h4 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Delete this record?</h4>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>This cannot be undone.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onConfirm} style={{ flex: 1, padding: '9px 0', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Delete</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>Cancel</button>
      </div>
    </div>
  </div>
);

// ─── Shared styles ────────────────────────────────────────────

const cancelStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 13, fontWeight: 500,
  color: 'var(--text-secondary)', background: 'none',
  border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
};

function smallBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '5px 10px', fontSize: 11, fontWeight: 600,
    background: bg, color, border: 'none', borderRadius: 6, cursor: 'pointer',
  };
}

function iconBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    width: 28, height: 28, background: bg, color, border: 'none',
    borderRadius: 6, cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

export default BusinessDataEntry;
