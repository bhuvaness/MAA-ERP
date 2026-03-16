/**
 * pineconeSearchService.js
 * Uses Pinecone REST API directly for embedding — bypasses SDK version issues.
 */

import { Pinecone } from '@pinecone-database/pinecone';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME       = process.env.PINECONE_INDEX_NAME  || 'maa-erp-types';
const EMBED_MODEL      = process.env.PINECONE_EMBED_MODEL || 'multilingual-e5-large';
const DEFAULT_TOP_K    = 5;

if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not set in .env');

const pc = new Pinecone({ apiKey: PINECONE_API_KEY });

// ─── Embed via Pinecone REST API (bypasses SDK version differences) ───────────
async function generateEmbedding(text) {
  const response = await fetch('https://api.pinecone.io/embed', {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2024-10',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      inputs: [{ text }],
      parameters: { input_type: 'query', truncate: 'END' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pinecone embed failed (${response.status}): ${err}`);
  }

  const json = await response.json();
  console.log('[pinecone] embed response keys:', Object.keys(json));

  // REST API returns { data: [{ values: [...] }] }
  const vector = json?.data?.[0]?.values;

  if (!vector || !Array.isArray(vector)) {
    throw new Error(`No vector in embed response. Keys: ${JSON.stringify(Object.keys(json))}`);
  }

  console.log(`[pinecone] vector dim: ${vector.length}`);
  return vector;
}

// ─── Search ───────────────────────────────────────────────────────────────────
export async function searchPinecone(prompt, topK = DEFAULT_TOP_K) {
  if (!prompt?.trim()) throw new Error('Prompt must be a non-empty string.');

  console.log(`[pinecone] query: "${prompt}"`);

  const queryVector = await generateEmbedding(prompt.trim());

  const index = pc.index(INDEX_NAME);
  const queryResponse = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    includeValues: false,
  });

  const matches = (queryResponse?.matches ?? []).map((match) => ({
    payanarssTypeId: match.id,
    score: parseFloat((match.score ?? 0).toFixed(4)),
    metadata: {
      name:        match.metadata?.name        ?? match.id,
      description: match.metadata?.description ?? '',
      category:    match.metadata?.category    ?? '',
      type:        match.metadata?.type        ?? '',
      parentName:  match.metadata?.parentName  ?? '',
    },
  }));

  console.log(`[pinecone] matched ${matches.length} result(s)`);
  return { query: prompt.trim(), model: EMBED_MODEL, index: INDEX_NAME, topK, matches };
}
