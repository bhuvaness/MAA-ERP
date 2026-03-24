/**
 * Pinecone Vector Service
 * =======================
 * Client-side abstraction for vector DB operations.
 *
 * CURRENT:  Vite dev-server plugin at /api/pinecone/*
 * FUTURE:   Swap endpoints to REST API — zero component changes.
 *
 * Architecture:
 *   Component -> App.tsx handler -> pineconeService -> Vite plugin (Pinecone cloud)
 *
 * Design: Option C (Hybrid)
 *   EMBED    -> keyword-rich text (what a human would search for)
 *   METADATA -> structured fields (what a computer filters/sorts by)
 *
 * All functions are NON-BLOCKING — return { success: false } on failure.
 * Pinecone being unavailable never blocks local saves.
 */

// ─── Response Types ─────────────────────────────────────────

export interface PineconeUpsertResponse {
  success: boolean;
  recordId?: string;
  contentLength?: number;
  error?: string;
}

export interface PineconeHit {
  _id: string;
  _score: number;
  fields: {
    content: string;
    table: string;
    module: string;
    entity_type: string;
    table_id: string;
    parent_record_id?: string;
    date?: string;
    month?: string;
    year?: number;
    // Dynamic metadata fields (Name, Department, Basic, etc.)
    [key: string]: unknown;
  };
}

export interface PineconeQueryResponse {
  success: boolean;
  results: PineconeHit[];
  error?: string;
}

export interface PineconeInitResponse {
  success: boolean;
  index?: string;
  error?: string;
}

// ─── Service Functions ──────────────────────────────────────

/**
 * Initialize the Pinecone index (connects to existing index).
 * Call once at app startup — safe to call multiple times.
 */
export async function initPinecone(): Promise<PineconeInitResponse> {
  try {
    const response = await fetch('/api/pinecone/init', { method: 'POST' });
    return await response.json();
  } catch (err) {
    console.warn('Pinecone init failed (non-fatal):', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Upsert a record to Pinecone for vector search.
 * Called after a successful local file save.
 *
 * The server-side plugin handles:
 *   - Building keyword-rich embed text (Option C hybrid)
 *   - Extracting structured metadata for filtering
 *   - Calling Pinecone's integrated inference (auto-embedding)
 *
 * @param recordId       — UUID from the local save
 * @param recordType     — 'employee' | 'salary' | 'address' | 'documents' | 'bank'
 * @param tableId        — PayanarssType TABLE_TYPE Id
 * @param data           — form field values keyed by column IDs
 * @param parentRecordId — optional parent link
 */
export async function upsertToVector(
  recordId: string,
  recordType: string,
  tableId: string,
  data: Record<string, unknown>,
  parentRecordId?: string,
): Promise<PineconeUpsertResponse> {
  try {
    const response = await fetch('/api/pinecone/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, recordType, tableId, data, parentRecordId }),
    });
    return await response.json();
  } catch (err) {
    console.warn('Pinecone upsert failed (non-fatal):', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Query Pinecone with natural language text.
 *
 * @param query      — free-text search query from user
 * @param topK       — number of results (default 5)
 * @param recordType — optional filter by record type
 * @param filter     — optional Pinecone metadata filter object
 */
export async function queryVectors(
  query: string,
  topK = 5,
  recordType?: string,
  filter?: Record<string, unknown>,
): Promise<PineconeQueryResponse> {
  try {
    const response = await fetch('/api/pinecone/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK, recordType, filter }),
    });
    return await response.json();
  } catch (err) {
    console.warn('Pinecone query failed (non-fatal):', err);
    return { success: false, results: [], error: String(err) };
  }
}

/**
 * Delete a record from Pinecone.
 */
export async function deleteFromVector(recordId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/pinecone/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
    });
    return await response.json();
  } catch (err) {
    console.warn('Pinecone delete failed (non-fatal):', err);
    return { success: false, error: String(err) };
  }
}
