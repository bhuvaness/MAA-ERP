/**
 * queryRoutes.js — MAA ERP Public Query API
 * ==========================================
 * Receives NLP prompts from third-party apps.
 * Searches the maa-erp-transactions Pinecone index.
 * Returns structured results with resolved display names.
 *
 * Endpoints:
 *   POST /api/query          — main NLP query endpoint
 *   POST /api/query/explain  — query + Claude explanation
 *   GET  /api/query/health   — verify Pinecone connectivity
 *
 * Example third-party call:
 *   POST /api/query
 *   { "prompt": "How many gym members selected bodybuilder segment?",
 *     "context": { "businessId": "gym-001" } }
 */

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────

const PINECONE_API_BASE      = 'https://api.pinecone.io';
const PINECONE_EMBED_MODEL   = 'multilingual-e5-large';
const PINECONE_API_VERSION   = '2025-01';
const PINECONE_NAMESPACE     = 'business-data';
const TRANSACTION_INDEX_HOST = process.env.PINECONE_TRANSACTION_HOST
  ?? 'maa-erp-transactions-y3f7eec.svc.aped-4627-b74a.pinecone.io';

// ─── Pinecone helpers ─────────────────────────────────────────

async function embedQuery(text, apiKey) {
  const res = await fetch(`${PINECONE_API_BASE}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type':           'application/json',
      'Api-Key':                apiKey,
      'X-Pinecone-API-Version': PINECONE_API_VERSION,
    },
    body: JSON.stringify({
      model:      PINECONE_EMBED_MODEL,
      inputs:     [{ text }],
      parameters: { input_type: 'query', truncate: 'END' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Pinecone embed error: ${err.message ?? res.status}`);
  }
  const data = await res.json();
  return data.data[0].values;
}

async function pineconeQuery(vector, topK, apiKey, filter) {
  const body = { vector, topK, includeMetadata: true, namespace: PINECONE_NAMESPACE };
  if (filter) body.filter = filter;

  const res = await fetch(`https://${TRANSACTION_INDEX_HOST}/query`, {
    method: 'POST',
    headers: {
      'Content-Type':           'application/json',
      'Api-Key':                apiKey,
      'X-Pinecone-API-Version': PINECONE_API_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Pinecone query error: ${err.message ?? res.status}`);
  }
  const data = await res.json();
  return data.matches ?? [];
}

// ─── Result hydration ─────────────────────────────────────────

/**
 * Hydrate a Pinecone match with actual record data from the file system.
 * Pinecone metadata is used for display only.
 * File system is the source of truth.
 */
async function hydrateMatch(match, registry) {
  const m = match.metadata;
  const tableId  = m.table_id;
  const recordId = m.record_id;

  // Base result from Pinecone metadata
  const result = {
    recordId,
    tableId,
    tableName:    m.table_name    ?? '',
    useCaseName:  m.use_case_name ?? '',
    phaseName:    m.phase_name    ?? '',
    segmentIds:   (m.segment_ids   ?? '').split('|').filter(Boolean),
    segmentNames: (m.segment_names ?? '').split('|').filter(Boolean),
    score:        Math.round(match.score * 1000) / 1000,
    data:         null,
    resolvedData: null,
  };

  // Hydrate with actual record data from file system via records router
  try {
    const recordsDir = new URL('../api/records', import.meta.url).pathname;
    const { readFileSync, existsSync } = await import('fs');
    const filePath = `${recordsDir}/${tableId}.json`;

    if (existsSync(filePath)) {
      const tableData = JSON.parse(readFileSync(filePath, 'utf8'));
      const record = tableData.records?.find(r => r.id === recordId);
      if (record) {
        result.data = record.data;

        // Resolve all field values using TypeRegistry
        if (registry) {
          const resolved = {};
          for (const [colId, storedValue] of Object.entries(record.data)) {
            const colNode    = registry.getNode(colId);
            const colName    = colNode?.Name ?? colId;
            const isLookup   = registry.isLookupValueId(storedValue);
            resolved[colName] = isLookup
              ? registry.resolveLookup(storedValue)
              : storedValue === 'true' ? 'Yes'
              : storedValue === 'false' ? 'No'
              : storedValue;
          }
          result.resolvedData = resolved;
        }
      }
    }
  } catch (err) {
    console.warn(`[query] Could not hydrate ${recordId}:`, err.message);
  }

  return result;
}

// ─── POST /api/query ──────────────────────────────────────────
/**
 * Main NLP query endpoint.
 * Third-party apps POST a natural language prompt and receive
 * structured results from the transaction vector DB.
 *
 * Request body:
 * {
 *   "prompt":  "How many members chose the bodybuilder segment?",
 *   "topK":    10,              // optional, default 10
 *   "context": {                // optional filters
 *     "tableName":    "TargetCustomer",
 *     "phaseName":    "Define Business Vision and Goals",
 *     "segmentName":  "Bodybuilders"
 *   }
 * }
 *
 * Response:
 * {
 *   "prompt":   "...",
 *   "total":    2,
 *   "results":  [
 *     {
 *       "recordId":     "f5208e40-...",
 *       "tableName":    "TargetCustomer",
 *       "useCaseName":  "Identify Target Customer Segment",
 *       "phaseName":    "Define Business Vision and Goals",
 *       "segmentNames": ["Bodybuilders"],
 *       "score":        0.923,
 *       "resolvedData": {
 *         "CustomerSegmentTypeName": "Bodybuilders",
 *         "IsActive": "Yes",
 *         "PriorityLevel": "1"
 *       }
 *     }
 *   ]
 * }
 */
router.post('/', async (req, res) => {
  const { prompt, topK = 10, context = {} } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PINECONE_API_KEY not configured' });
  }

  console.log(`\n[query] Prompt: "${prompt}"`);

  try {
    // Step 1: Embed the prompt
    const vector = await embedQuery(prompt, apiKey);

    // Step 2: Detect segment name in prompt for metadata filtering
    // Load all LookupValueType names from registry and check if any appear in prompt
    let detectedSegmentFilter = null;
    const registry = req.registry;
    if (registry) {
      // Get all node names and check if prompt mentions one
      const lowerPrompt = prompt.toLowerCase();
      // Check all known segment names from registry
      for (const [id, name] of (registry.lookupMap ?? new Map())) {
        if (name && lowerPrompt.includes(name.toLowerCase())) {
          detectedSegmentFilter = name;
          console.log(`[query] Detected segment in prompt: "${name}"`);
          break;
        }
      }
    }

    // Step 3: Build Pinecone filter
    // Use metadata filter for exact segment match when detected
    // This prevents semantically similar records from bleeding through
    const pineconeFilter = detectedSegmentFilter
      ? { segment_names: { $eq: detectedSegmentFilter } }
      : undefined;

    // Step 4: Query Pinecone transaction index
    const matches = await pineconeQuery(vector, topK, apiKey, pineconeFilter);
    console.log(`[query] Pinecone returned ${matches.length} matches${detectedSegmentFilter ? ` (filtered by segment: "${detectedSegmentFilter}")` : ''}`);

    // Step 5: Additional client-side filtering by context
    const filtered = matches.filter(m => {
      const meta = m.metadata;
      if (context.tableName   && meta.table_name    !== context.tableName)   return false;
      if (context.phaseName   && meta.phase_name    !== context.phaseName)   return false;
      if (context.segmentName && meta.segment_names !== context.segmentName) return false;
      return true;
    });

    // Step 4: Hydrate with actual record data + TypeRegistry resolution
    const registry = req.registry ?? null;
    const results  = await Promise.all(
      filtered.map(m => hydrateMatch(m, registry))
    );

    console.log(`[query] Returning ${results.length} results`);

    return res.json({
      prompt,
      total:   results.length,
      results,
    });

  } catch (err) {
    console.error('[query] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/query/explain ──────────────────────────────────
/**
 * NLP query + Claude-generated explanation.
 * Searches the vector DB then passes results to Claude for a
 * human-readable answer.
 *
 * Additional env required: CLAUDE_API_KEY
 */
router.post('/explain', async (req, res) => {
  const { prompt, topK = 5, context = {} } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const pineconeKey = process.env.PINECONE_API_KEY;
  const claudeKey   = process.env.CLAUDE_API_KEY;

  if (!pineconeKey) return res.status(500).json({ error: 'PINECONE_API_KEY not configured' });
  if (!claudeKey)   return res.status(500).json({ error: 'CLAUDE_API_KEY not configured' });

  try {
    // Step 1: Search transaction index
    const vector  = await embedQuery(prompt, pineconeKey);
    const matches = await pineconeQuery(vector, topK, pineconeKey);
    const registry = req.registry ?? null;
    const results  = await Promise.all(matches.map(m => hydrateMatch(m, registry)));

    // Step 2: Build context for Claude
    const dataContext = results
      .filter(r => r.resolvedData)
      .map((r, i) => {
        const fields = Object.entries(r.resolvedData)
          .map(([k, v]) => `    ${k}: ${v}`)
          .join('\n');
        return `Record ${i + 1} (${r.tableName} — ${r.useCaseName}):\n${fields}`;
      })
      .join('\n\n');

    if (!dataContext) {
      return res.json({
        prompt,
        answer: 'No relevant data found in the system for this query.',
        results,
      });
    }

    // Step 3: Ask Claude to explain
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 512,
        system:     'You are a business data assistant for MAA ERP. Answer questions about business data clearly and concisely. Use only the data provided. Do not invent facts.',
        messages: [{
          role:    'user',
          content: `Business data from the system:\n\n${dataContext}\n\nQuestion: ${prompt}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const answer = claudeData.content?.[0]?.text ?? 'Could not generate explanation.';

    return res.json({ prompt, answer, total: results.length, results });

  } catch (err) {
    console.error('[query/explain] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/query/health ────────────────────────────────────

router.get('/health', async (req, res) => {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return res.json({ status: 'error', reason: 'PINECONE_API_KEY not set' });

  try {
    // Quick connectivity check — embed a test string
    await embedQuery('health check', apiKey);
    res.json({
      status:     'ok',
      index:      TRANSACTION_INDEX_HOST,
      namespace:  PINECONE_NAMESPACE,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', reason: err.message });
  }
});

export default router;
