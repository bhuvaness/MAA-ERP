/**
 * pineconeSearchService.js — calls Pinecone REST API directly.
 *
 * .env required:
 *   PINECONE_API_KEY=pcsk_...
 *   PINECONE_INDEX_HOST=maa-erp-types-y3f7eec.svc.aped-4627-b74a.pinecone.io
 *   PINECONE_INDEX_NAME=maa-erp-types
 *   PINECONE_NAMESPACE=payanarss-types
 *   PINECONE_EMBED_MODEL=multilingual-e5-large
 */

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_HOST       = process.env.PINECONE_INDEX_HOST  || 'maa-erp-types-y3f7eec.svc.aped-4627-b74a.pinecone.io';
const INDEX_NAME       = process.env.PINECONE_INDEX_NAME  || 'maa-erp-types';
const NAMESPACE        = process.env.PINECONE_NAMESPACE   || 'payanarss-types';
const EMBED_MODEL      = process.env.PINECONE_EMBED_MODEL || 'multilingual-e5-large';

if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not set in .env');

const pineconeHeaders = {
  'Api-Key': PINECONE_API_KEY,
  'Content-Type': 'application/json',
};

// ─── Embed ────────────────────────────────────────────────────
async function generateEmbedding(text) {
  const res = await fetch('https://api.pinecone.io/embed', {
    method: 'POST',
    headers: { ...pineconeHeaders, 'X-Pinecone-API-Version': '2024-10' },
    body: JSON.stringify({
      model: EMBED_MODEL,
      inputs: [{ text }],
      parameters: { input_type: 'query', truncate: 'END' },
    }),
  });

  if (!res.ok) throw new Error(`Embed failed (${res.status}): ${await res.text()}`);

  const json   = await res.json();
  const vector = json?.data?.[0]?.values;
  if (!vector) throw new Error(`No vector in embed response. Keys: ${Object.keys(json)}`);

  console.log(`[pinecone] embedded → dim ${vector.length}`);
  return vector;
}

// ─── Search ───────────────────────────────────────────────────
export async function searchPinecone(prompt, topK = 10) {
  if (!prompt?.trim()) throw new Error('Prompt must be a non-empty string.');

  console.log(`[pinecone] query: "${prompt}" | namespace: ${NAMESPACE}`);

  const vector = await generateEmbedding(prompt.trim());

  const res = await fetch(`https://${INDEX_HOST}/query`, {
    method: 'POST',
    headers: pineconeHeaders,
    body: JSON.stringify({
      vector,
      topK,
      namespace: NAMESPACE,       // ← THIS was missing — data lives here
      includeMetadata: true,
      includeValues: false,
    }),
  });

  if (!res.ok) throw new Error(`Query failed (${res.status}): ${await res.text()}`);

  const result  = await res.json();
  const matches = result?.matches ?? [];

  console.log(`[pinecone] ${matches.length} match(es) in namespace "${NAMESPACE}"`);

  return {
    query:   prompt.trim(),
    model:   EMBED_MODEL,
    index:   INDEX_NAME,
    namespace: NAMESPACE,
    topK,
    matches: matches.map((m) => ({
      payanarssTypeId: m.id,
      score: parseFloat((m.score ?? 0).toFixed(4)),
      metadata: {
        name:        m.metadata?.name        ?? m.id,
        description: m.metadata?.description ?? '',
        level:       m.metadata?.level       ?? '',
        sector:      m.metadata?.sector      ?? '',
        module:      m.metadata?.module      ?? '',
        type:        m.metadata?.type        ?? '',
        parentName:  m.metadata?.parent_name ?? m.metadata?.parentName ?? '',
        path:        m.metadata?.path        ?? '',
      },
    })),
  };
}

// ─── Stats ────────────────────────────────────────────────────
export async function getPineconeStats() {
  const res = await fetch(`https://${INDEX_HOST}/describe_index_stats`, {
    headers: pineconeHeaders,
  });
  if (!res.ok) throw new Error(`Stats failed (${res.status}): ${await res.text()}`);
  return res.json();
}
