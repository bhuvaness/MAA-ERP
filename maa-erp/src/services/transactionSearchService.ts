/**
 * transactionSearchService.ts
 * ============================
 * Queries maa-erp-transactions Pinecone index for semantic search.
 * Actual record data is always hydrated from the file API (source of truth).
 *
 * Separation of concerns:
 *   Pinecone → "which records are relevant to this query?"
 *   File API → "give me the actual data for those records"
 */

const PINECONE_API_BASE      = 'https://api.pinecone.io';
const PINECONE_EMBED_MODEL   = 'multilingual-e5-large';
const PINECONE_API_VERSION   = '2025-01';
const PINECONE_NAMESPACE     = 'business-data';
const TRANSACTION_INDEX_HOST = 'maa-erp-transactions-y3f7eec.svc.aped-4627-b74a.pinecone.io';

const API_BASE = (import.meta as any).env?.VITE_EXPRESS_API ?? 'http://localhost:3001/api';

// ─── Types ────────────────────────────────────────────────────

export interface SearchHit {
  recordId:     string;
  tableId:      string;
  tableName:    string;
  useCaseName:  string;
  phaseName:    string;
  segmentIds:   string[];
  segmentNames: string[];
  score:        number;
  // Hydrated from file API after search
  data?:        Record<string, string>;
}

export interface ActiveSegment {
  segmentId:   string;
  segmentName: string;
  recordId:    string;
  tableId:     string;
  tableName:   string;
}

// ─── Helpers ──────────────────────────────────────────────────

function getApiKey(): string {
  const key = (import.meta as any).env?.VITE_PINECONE_API_KEY;
  if (!key) throw new Error('VITE_PINECONE_API_KEY not set');
  return key;
}

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
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
      parameters: { input_type: 'query', truncate: 'END' },
    }),
  });
  if (!res.ok) throw new Error(`Embed error: ${res.status}`);
  const data = await res.json() as { data: { values: number[] }[] };
  return data.data[0].values;
}

async function pineconeQuery(
  vector: number[],
  topK:   number,
  apiKey: string
): Promise<{ id: string; score: number; metadata: Record<string, unknown> }[]> {
  const res = await fetch(`https://${TRANSACTION_INDEX_HOST}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'X-Pinecone-API-Version': PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true,
      namespace: PINECONE_NAMESPACE,
    }),
  });
  if (!res.ok) throw new Error(`Query error: ${res.status}`);
  const data = await res.json() as { matches?: unknown[] };
  return (data.matches ?? []) as { id: string; score: number; metadata: Record<string, unknown> }[];
}

function parseHit(
  match: { id: string; score: number; metadata: Record<string, unknown> }
): SearchHit {
  const m = match.metadata;
  return {
    recordId:     (m.record_id     as string) ?? '',
    tableId:      (m.table_id      as string) ?? '',
    tableName:    (m.table_name    as string) ?? '',
    useCaseName:  (m.use_case_name as string) ?? '',
    phaseName:    (m.phase_name    as string) ?? '',
    segmentIds:   ((m.segment_ids   as string) ?? '').split('|').filter(Boolean),
    segmentNames: ((m.segment_names as string) ?? '').split('|').filter(Boolean),
    score:        match.score,
  };
}

/**
 * Hydrate search hits with actual record data from the file API.
 * Pinecone metadata is used for display only — file API is source of truth.
 */
async function hydrateHits(hits: SearchHit[]): Promise<SearchHit[]> {
  return Promise.all(hits.map(async hit => {
    try {
      const res = await fetch(
        `${API_BASE}/records/${encodeURIComponent(hit.tableId)}/${encodeURIComponent(hit.recordId)}`
      );
      if (res.ok) {
        const json = await res.json() as { record?: { data: Record<string, string> } };
        return { ...hit, data: json.record?.data };
      }
    } catch { /* server unavailable — return hit without data */ }
    return hit;
  }));
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Search transaction records by natural language.
 * Returns hits hydrated with actual data from the file API.
 *
 * @param query  - natural language (e.g. "bodybuilder equipment")
 * @param topK   - max results
 * @param hydrate - whether to fetch actual data from file API (default: true)
 */
export async function searchTransactions(
  query:   string,
  topK =   10,
  hydrate = true
): Promise<SearchHit[]> {
  const apiKey  = getApiKey();
  const vector  = await embedQuery(query, apiKey);
  const matches = await pineconeQuery(vector, topK, apiKey);
  const hits    = matches.map(parseHit);

  console.log(`[txSearch] "${query}" → ${hits.length} hits`);

  return hydrate ? hydrateHits(hits) : hits;
}

/**
 * Get all active customer segments from saved TargetCustomer records.
 * Used to drive ActivationRule filtering for subsequent use cases.
 *
 * Strategy:
 *   1. Search for "customer segment" in transactions index
 *   2. Filter hits by tableId
 *   3. Hydrate from file API — actual data is source of truth
 *   4. Extract segment Ids from the hydrated records
 *
 * @param targetCustomerTableId - PayanarssType Id of TargetCustomer table
 * @param segmentColId          - column Id that stores the segment lookup value
 */
export async function getActiveSegments(
  targetCustomerTableId: string,
  segmentColId: string
): Promise<ActiveSegment[]> {
  // Step 1: Get all records from file API (most reliable)
  try {
    const res = await fetch(
      `${API_BASE}/records/${encodeURIComponent(targetCustomerTableId)}`
    );
    if (res.ok) {
      const json = await res.json() as {
        records: { id: string; data: Record<string, string> }[];
        tableName: string;
      };

      const results: ActiveSegment[] = [];
      const seen = new Set<string>();

      for (const record of (json.records ?? [])) {
        const segmentId = record.data[segmentColId];
        if (segmentId && !seen.has(segmentId)) {
          seen.add(segmentId);
          results.push({
            segmentId,
            segmentName: '', // resolved by caller via allTypes
            recordId:   record.id,
            tableId:    targetCustomerTableId,
            tableName:  json.tableName,
          });
        }
      }

      console.log(`[txSearch] Active segments from file: ${results.map(r => r.segmentId).join(', ')}`);
      return results;
    }
  } catch { /* fall through to Pinecone fallback */ }

  // Step 2: Fallback — search Pinecone if file API unavailable
  console.warn('[txSearch] File API unavailable, falling back to Pinecone');
  const hits = await searchTransactions('customer segment target', 50, false);
  const relevant = hits.filter(h => h.tableId === targetCustomerTableId);

  const results: ActiveSegment[] = [];
  const seen = new Set<string>();

  for (const hit of relevant) {
    hit.segmentIds.forEach((segId, i) => {
      if (!seen.has(segId)) {
        seen.add(segId);
        results.push({
          segmentId:   segId,
          segmentName: hit.segmentNames[i] ?? '',
          recordId:    hit.recordId,
          tableId:     hit.tableId,
          tableName:   hit.tableName,
        });
      }
    });
  }

  return results;
}
