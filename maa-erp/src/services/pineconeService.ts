/**
 * pineconeService.ts — MAA ERP Record Store
 * ==========================================
 * Direct browser → Pinecone for ERP record operations.
 * Replaces the /api/pinecone/* Vite proxy.
 *
 * This index stores BUSINESS DATA (employee records, salary, etc.)
 * It is separate from the maa-erp-types index (PTS metadata).
 *
 * Uses Pinecone's Inference API for auto-embedding — no local model needed.
 *
 * SETUP: .env must contain:
 *   VITE_PINECONE_API_KEY=pcsk_...
 *   VITE_PINECONE_ERP_INDEX_HOST=<your-erp-records-index-host>
 *
 * NOTE: Create a separate Pinecone index for ERP records:
 *   Name: maa-erp-records (or similar)
 *   Model: multilingual-e5-large
 *   Metric: cosine
 *
 * All functions are NON-BLOCKING — return { success: false } on failure.
 * Pinecone being unavailable never blocks local saves.
 */

// ─── Config ───────────────────────────────────────────────────

const PINECONE_API_BASE = "https://api.pinecone.io";
const PINECONE_EMBED_MODEL = "multilingual-e5-large";
const PINECONE_NAMESPACE = "erp-records";
const PINECONE_API_VERSION = "2025-01";

function getApiKey(): string {
  const key = import.meta.env.VITE_PINECONE_API_KEY;
  if (!key) throw new Error("VITE_PINECONE_API_KEY not set in .env");
  return key;
}

function getErpIndexHost(): string {
  const host = import.meta.env.VITE_PINECONE_ERP_INDEX_HOST;
  if (!host) throw new Error("VITE_PINECONE_ERP_INDEX_HOST not set in .env");
  return host;
}

// ─── Response Types (unchanged — same interface as before) ────

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

// ─── Internal helpers ─────────────────────────────────────────

/**
 * Build keyword-rich embed text from a record.
 * Same hybrid strategy as before (Option C):
 * human-readable text for the vector, structured fields in metadata.
 */
function buildEmbedText(
  recordType: string,
  tableId: string,
  data: Record<string, unknown>
): string {
  const fieldPairs = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return `${recordType} record. Table: ${tableId}. ${fieldPairs}`.trim();
}

/**
 * Extract structured metadata from a record for filtering.
 */
function buildMetadata(
  recordId: string,
  recordType: string,
  tableId: string,
  data: Record<string, unknown>,
  parentRecordId?: string
): Record<string, unknown> {
  const now = new Date();
  const metadata: Record<string, unknown> = {
    content: buildEmbedText(recordType, tableId, data),
    table: recordType,
    module: recordType.split("_")[0] ?? recordType,
    entity_type: recordType,
    table_id: tableId,
    date: now.toISOString().split("T")[0],
    month: now.toLocaleString("default", { month: "long" }),
    year: now.getFullYear(),
    record_id: recordId,
  };

  if (parentRecordId) metadata.parent_record_id = parentRecordId;

  // Include all data fields as top-level metadata for filtering
  for (const [key, value] of Object.entries(data)) {
    if (
      value !== null &&
      value !== undefined &&
      typeof value !== "object" &&
      !Array.isArray(value)
    ) {
      metadata[key] = value;
    }
  }

  return metadata;
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(`${PINECONE_API_BASE}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "X-Pinecone-API-Version": PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      model: PINECONE_EMBED_MODEL,
      inputs: [{ text }],
      parameters: { input_type: "passage", truncate: "END" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Embed error: ${err.message ?? res.status}`);
  }

  const data = await res.json() as { data: { values: number[] }[] };
  return data.data[0].values;
}

// ─── Service Functions ────────────────────────────────────────

/**
 * Initialize — verifies the ERP index is reachable.
 * Safe to call multiple times.
 */
export async function initPinecone(): Promise<PineconeInitResponse> {
  try {
    const apiKey = getApiKey();
    const indexHost = getErpIndexHost();

    const res = await fetch(`https://${indexHost}/describe_index_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "X-Pinecone-API-Version": PINECONE_API_VERSION,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

    const data = await res.json() as { namespaces?: Record<string, unknown> };
    console.log("[pinecone] ERP index ready:", data);
    return { success: true, index: indexHost };
  } catch (err) {
    console.warn("[pinecone] init failed (non-fatal):", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Upsert an ERP record into the vector store.
 * Called after a successful local file save.
 *
 * @param recordId       — UUID from the local save
 * @param recordType     — 'employee' | 'salary' | 'address' | etc.
 * @param tableId        — PayanarssType TABLE_TYPE Id
 * @param data           — form field values keyed by column IDs
 * @param parentRecordId — optional parent link
 */
export async function upsertToVector(
  recordId: string,
  recordType: string,
  tableId: string,
  data: Record<string, unknown>,
  parentRecordId?: string
): Promise<PineconeUpsertResponse> {
  try {
    const apiKey = getApiKey();
    const indexHost = getErpIndexHost();

    // Build embed text + metadata
    const embedText_ = buildEmbedText(recordType, tableId, data);
    const metadata = buildMetadata(recordId, recordType, tableId, data, parentRecordId);

    // Embed
    const vector = await embedText(embedText_, apiKey);

    // Upsert
    const res = await fetch(`https://${indexHost}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "X-Pinecone-API-Version": PINECONE_API_VERSION,
      },
      body: JSON.stringify({
        vectors: [{ id: recordId, values: vector, metadata }],
        namespace: PINECONE_NAMESPACE,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `HTTP ${res.status}`);
    }

    return { success: true, recordId, contentLength: embedText_.length };
  } catch (err) {
    console.warn("[pinecone] upsert failed (non-fatal):", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Query ERP records with natural language.
 *
 * @param query      — free-text search (e.g. "employees in IT department")
 * @param topK       — number of results (default 5)
 * @param recordType — optional filter by record type ('employee', 'salary', etc.)
 * @param filter     — optional additional Pinecone metadata filter
 */
export async function queryVectors(
  query: string,
  topK = 5,
  recordType?: string,
  filter?: Record<string, unknown>
): Promise<PineconeQueryResponse> {
  try {
    const apiKey = getApiKey();
    const indexHost = getErpIndexHost();

    // Embed the query
    const queryVector = await embedText(query, apiKey);

    // Build filter
    const combinedFilter: Record<string, unknown> = { ...filter };
    if (recordType) combinedFilter.entity_type = { $eq: recordType };

    const body: Record<string, unknown> = {
      vector: queryVector,
      topK,
      includeMetadata: true,
      namespace: PINECONE_NAMESPACE,
    };
    if (Object.keys(combinedFilter).length > 0) body.filter = combinedFilter;

    const res = await fetch(`https://${indexHost}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "X-Pinecone-API-Version": PINECONE_API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json() as {
      matches?: { id: string; score: number; metadata: Record<string, unknown> }[];
    };

    // Normalise to PineconeHit shape
    const results: PineconeHit[] = (data.matches ?? []).map((m) => ({
      _id: m.id,
      _score: m.score,
      fields: m.metadata as PineconeHit["fields"],
    }));

    return { success: true, results };
  } catch (err) {
    console.warn("[pinecone] query failed (non-fatal):", err);
    return { success: false, results: [], error: String(err) };
  }
}

/**
 * Delete an ERP record from the vector store.
 */
export async function deleteFromVector(
  recordId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = getApiKey();
    const indexHost = getErpIndexHost();

    const res = await fetch(`https://${indexHost}/vectors/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
        "X-Pinecone-API-Version": PINECONE_API_VERSION,
      },
      body: JSON.stringify({
        ids: [recordId],
        namespace: PINECONE_NAMESPACE,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message ?? `HTTP ${res.status}`);
    }

    return { success: true };
  } catch (err) {
    console.warn("[pinecone] delete failed (non-fatal):", err);
    return { success: false, error: String(err) };
  }
}
