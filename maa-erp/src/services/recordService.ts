/**
 * Record Service
 * ==============
 * Client-side abstraction for CRUD on form records.
 *
 * CURRENT:  Vite dev-server plugin at /api/records/*
 * FUTURE:   Swap endpoints to REST API — zero component changes.
 *
 * Architecture:
 *   Component → App.tsx handler → recordService → Vite plugin (file system)
 */

import type { RecordType, SavedRecord, SaveRecordResponse, ListRecordsResponse } from '../types/Record';
import type { SetupData } from '../types';

// ─── Business Config types ────────────────────────────────────

export interface BusinessConfig {
  setupComplete: boolean;
  setupData: SetupData;
  selectedTypeIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LoadConfigResponse {
  success: boolean;
  exists: boolean;
  config: BusinessConfig | null;
  error?: string;
}

/**
 * Save a new record. The server generates a UUID v4 for the filename.
 *
 * @param recordType     — 'employee' | 'salary' | 'address' | 'documents' | 'bank'
 * @param data           — form field values keyed by PayanarssType column IDs
 * @param tableId        — PayanarssType TABLE_TYPE Id this record belongs to
 * @param parentRecordId — optional link to parent (e.g., salary → employee)
 * @returns { success, id } where id is the generated UUID
 */
export async function saveRecord(
  recordType: RecordType,
  data: Record<string, unknown>,
  tableId: string,
  parentRecordId?: string,
): Promise<SaveRecordResponse> {
  try {
    const response = await fetch('/api/records/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordType, tableId, data, parentRecordId }),
    });
    return await response.json();
  } catch (err) {
    console.error('❌ recordService.saveRecord failed:', err);
    return { success: false, id: '', error: String(err) };
  }
}

/**
 * List all records, optionally filtered by type or parent.
 *
 * @param type      — filter by recordType
 * @param parentId  — filter by parentRecordId
 */
export async function listRecords(
  type?: RecordType,
  parentId?: string,
): Promise<ListRecordsResponse> {
  try {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (parentId) params.set('parentId', parentId);
    const response = await fetch(`/api/records/list?${params.toString()}`);
    return await response.json();
  } catch (err) {
    console.error('❌ recordService.listRecords failed:', err);
    return { success: false, records: [], count: 0, error: String(err) };
  }
}

/**
 * Load a single record by its UUID.
 */
export async function loadRecord(id: string): Promise<SavedRecord | null> {
  try {
    const response = await fetch(`/api/records/get?id=${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('❌ recordService.loadRecord failed:', err);
    return null;
  }
}

/**
 * Delete a record by its UUID.
 */
export async function deleteRecord(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/records/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return await response.json();
  } catch (err) {
    console.error('❌ recordService.deleteRecord failed:', err);
    return { success: false, error: String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════
// Business Config — save/load "Set My Business" data
// ═══════════════════════════════════════════════════════════════

/**
 * Save the business configuration (setup data + selected module IDs).
 * Saved as data/business-config.json via Vite dev-server plugin.
 */
export async function saveBusinessConfig(config: BusinessConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return await response.json();
  } catch (err) {
    console.error('❌ recordService.saveBusinessConfig failed:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Load the saved business configuration on app startup.
 * Returns { exists: false } if no config saved yet.
 */
export async function loadBusinessConfig(): Promise<LoadConfigResponse> {
  try {
    const response = await fetch('/api/config/load');
    return await response.json();
  } catch (err) {
    console.error('❌ recordService.loadBusinessConfig failed:', err);
    return { success: false, exists: false, config: null, error: String(err) };
  }
}
