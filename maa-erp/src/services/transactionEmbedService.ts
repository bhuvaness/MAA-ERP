/**
 * transactionEmbedService.ts
 * ==========================
 * Embeds saved business records into maa-erp-transactions Pinecone index.
 *
 * Design principles:
 *   - ONE vector per record (not 3 layers)
 *   - Pinecone is SEARCH ONLY — not source of truth
 *   - Source of truth = servers/api/records/{tableId}.json
 *   - Activated use cases come from maa-erp-types index, not duplicated here
 *   - Schema changes don't require re-embedding
 *
 * Vector ID: {recordId}__{tableId}
 *
 * Required .env:
 *   VITE_PINECONE_API_KEY=pcsk_...
 */

import type { PayanarssType } from '../types/core';

// ─── Constants ────────────────────────────────────────────────

const PINECONE_API_BASE      = 'https://api.pinecone.io';
const PINECONE_EMBED_MODEL   = 'multilingual-e5-large';
const PINECONE_API_VERSION   = '2025-01';
const PINECONE_NAMESPACE     = 'business-data';
const TRANSACTION_INDEX_HOST = 'maa-erp-transactions-y3f7eec.svc.aped-4627-b74a.pinecone.io';

const PT_LOOKUP_VALUE = '1000000000000000000000000000000031';

// ─── Types ────────────────────────────────────────────────────

export interface EmbedRecordPayload {
  recordId:  string;
  tableId:   string;
  tableName: string;
  data:      Record<string, string>; // colId → stored value (Id-based)
  allTypes:  PayanarssType[];
}

// ─── Helpers ──────────────────────────────────────────────────

function getApiKey(): string {
  const key = (import.meta as any).env?.VITE_PINECONE_API_KEY;
  if (!key) throw new Error('VITE_PINECONE_API_KEY not set');
  return key;
}

function getAncestors(allTypes: PayanarssType[], nodeId: string): PayanarssType[] {
  const byId = new Map(allTypes.map(t => [t.Id, t]));
  const path: PayanarssType[] = [];
  let current = byId.get(nodeId);
  const visited = new Set<string>();
  while (current && current.Id !== current.ParentId && !visited.has(current.Id)) {
    visited.add(current.Id);
    const parent = byId.get(current.ParentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

/** Resolve a stored value to its display name */
function resolveDisplay(value: string, allTypes: PayanarssType[]): string {
  if (!value) return '';
  const node = allTypes.find(t => t.Id === value);
  if (node) return node.Name;
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  return value;
}

// ─── Build embedding text ─────────────────────────────────────

/**
 * Builds a simple, clean embedding text.
 * Contains only: field values + context names (use case, phase, segment).
 * Activated use cases are NOT included — they live in maa-erp-types index.
 */
export function buildEmbeddingText(payload: EmbedRecordPayload): {
  text: string;
  metadata: Record<string, string | number | boolean>;
} {
  const { recordId, tableId, tableName, data, allTypes } = payload;

  // Resolve ancestors for context names
  const ancestors  = getAncestors(allTypes, tableId);
  const useCaseName = ancestors[ancestors.length - 1]?.Name ?? '';
  const phaseName   = ancestors[ancestors.length - 2]?.Name ?? '';
  const pathString  = [...ancestors.map(a => a.Name), tableName].join(' > ');

  // Resolve field values — display names, not Ids
  const fieldLines:    string[] = [];
  const segmentIds:    string[] = [];
  const segmentNames:  string[] = [];

  for (const [colId, storedValue] of Object.entries(data)) {
    if (!storedValue) continue;
    const colNode   = allTypes.find(t => t.Id === colId);
    const colName   = colNode?.Name ?? colId;
    const display   = resolveDisplay(storedValue, allTypes);

    fieldLines.push(`  ${colName}: ${display}`);

    // Track lookup values (segments) for metadata
    const isLookup = allTypes.find(
      t => t.Id === storedValue && t.PayanarssTypeId === PT_LOOKUP_VALUE
    );
    if (isLookup) {
      segmentIds.push(storedValue);
      segmentNames.push(isLookup.Name);
    }
  }

  // Simple, focused embedding text
  const text = [
    `${tableName} — ${useCaseName}`,
    phaseName   ? `Phase: ${phaseName}`              : '',
    useCaseName ? `Use Case: ${useCaseName}`         : '',
    segmentNames.length > 0
      ? `Segments: ${segmentNames.join(', ')}`       : '',
    '',
    'Data:',
    ...fieldLines,
  ].filter(Boolean).join('\n').trim();

  // Minimal metadata for Pinecone filtering
  // Source of truth for actual data is the JSON file — NOT this metadata
  const metadata: Record<string, string | number | boolean> = {
    record_id:      recordId,
    table_id:       tableId,
    table_name:     tableName,
    use_case_name:  useCaseName,
    phase_name:     phaseName,
    segment_ids:    segmentIds.join('|'),
    segment_names:  segmentNames.join('|'),
    created_at:     new Date().toISOString(),
  };

  return { text, metadata };
}

// ─── Pinecone API ─────────────────────────────────────────────

async function pineconeEmbed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(`${PINECONE_API_BASE}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'X-Pinecone-API-Version': PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      model: PINECONE_EMBED_MODEL,
      inputs: [{ text }],
      parameters: { input_type: 'passage', truncate: 'END' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Pinecone embed error: ${err.message ?? res.status}`);
  }
  const data = await res.json() as { data: { values: number[] }[] };
  return data.data[0].values;
}

async function pineconeUpsert(
  id:       string,
  values:   number[],
  metadata: Record<string, string | number | boolean>,
  apiKey:   string
): Promise<void> {
  const res = await fetch(`https://${TRANSACTION_INDEX_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'X-Pinecone-API-Version': PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      vectors: [{ id, values, metadata }],
      namespace: PINECONE_NAMESPACE,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Pinecone upsert error: ${err.message ?? res.status}`);
  }
}

async function pineconeDelete(ids: string[], apiKey: string): Promise<void> {
  const res = await fetch(`https://${TRANSACTION_INDEX_HOST}/vectors/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'X-Pinecone-API-Version': PINECONE_API_VERSION,
    },
    body: JSON.stringify({ ids, namespace: PINECONE_NAMESPACE }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Pinecone delete error: ${err.message ?? res.status}`);
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Embed a saved record — ONE vector per record.
 * Called after every successful save or update.
 * Non-blocking — failures are logged but don't break the save flow.
 */
export async function embedRecord(payload: EmbedRecordPayload): Promise<void> {
  const apiKey  = getApiKey();
  const vectorId = `${payload.recordId}__${payload.tableId}`;

  const { text, metadata } = buildEmbeddingText(payload);

  console.log(`[txEmbed] Embedding ${payload.tableName}/${payload.recordId}`);
  console.log(`[txEmbed] Text: ${text.slice(0, 100)}...`);

  const values = await pineconeEmbed(text, apiKey);
  await pineconeUpsert(vectorId, values, metadata, apiKey);

  console.log(`[txEmbed] ✅ Upserted ${vectorId}`);
}

/**
 * Delete a record's vector when the record is deleted.
 */
export async function deleteRecordVector(
  recordId: string,
  tableId:  string
): Promise<void> {
  const apiKey  = getApiKey();
  const vectorId = `${recordId}__${tableId}`;
  await pineconeDelete([vectorId], apiKey);
  console.log(`[txEmbed] 🗑 Deleted ${vectorId}`);
}
