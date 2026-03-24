/**
 * claudeMatchRoute.js
 * POC: Ask Claude for top-level matches only, expand children locally.
 * This keeps Claude output small and avoids truncation.
 */

import express from 'express';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = express.Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const JSON_PATH = path.resolve(__dirname, '../public/data/VanakkamPayanarssTypes.json');

// Only sectors and top-level modules sent to Claude for matching
const TOP_LEVEL_TYPE_IDS = new Set([
  '10000000000000000000000000000011111',  // BusinessSolutions (sector)
  '10000000000000000000000000000001111',  // BusinessModules
  '100000000000000000000000000000004',    // GroupType
]);

// All meaningful types — used for local expansion
const ALL_MEANINGFUL_TYPE_IDS = new Set([
  '10000000000000000000000000000011111',
  '10000000000000000000000000000001111',
  '10000000000000000000000000000000111',  // BusinessUseCase
  '100000000000000000000000000000004',
  '100000000000000000000000000000002',    // TableType
]);

const SKIP_IDS = new Set([
  '100000000000000000000000000000000','100000000000000000000000000000001',
  '100000000000000000000000000000002','100000000000000000000000000000003',
  '100000000000000000000000000000004','100000000000000000000000000000005',
  '10000000000000000000000000000000111','10000000000000000000000000000001111',
  '10000000000000000000000000000011111',
]);

// ─── Cache ────────────────────────────────────────────────────
let _allCache = null;
let _topCache = null;

function loadData() {
  if (_allCache) return { all: _allCache, top: _topCache };

  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  // All meaningful nodes (for local expansion)
  _allCache = raw.filter(n =>
    ALL_MEANINGFUL_TYPE_IDS.has(n.PayanarssTypeId) && !SKIP_IDS.has(n.Id)
  ).map(n => ({ Id: n.Id, P: n.ParentId, N: n.Name }));

  // Top-level only (sent to Claude — small list)
  _topCache = raw.filter(n =>
    TOP_LEVEL_TYPE_IDS.has(n.PayanarssTypeId) && !SKIP_IDS.has(n.Id)
  ).map(n => ({ Id: n.Id, P: n.ParentId, N: n.Name }));

  console.log(`[claude-match] Cached: ${_allCache.length} all nodes, ${_topCache.length} top-level nodes`);
  return { all: _allCache, top: _topCache };
}

// ─── Expand: get all descendants of matched top-level IDs ─────
function expandWithDescendants(matchedIds, allNodes) {
  const byId       = new Map(allNodes.map(n => [n.Id, n]));
  const childrenOf = new Map();

  for (const n of allNodes) {
    if (n.Id === n.P) continue;
    if (!childrenOf.has(n.P)) childrenOf.set(n.P, []);
    childrenOf.get(n.P).push(n);
  }

  const result = new Set(matchedIds);

  function addDescendants(id) {
    for (const child of (childrenOf.get(id) || [])) {
      result.add(child.Id);
      addDescendants(child.Id);
    }
  }

  for (const id of matchedIds) addDescendants(id);
  return [...result];
}

// ─── Build display tree ───────────────────────────────────────
function buildTree(expandedIds, allNodes) {
  const byId       = new Map(allNodes.map(n => [n.Id, n]));
  const idSet      = new Set(expandedIds);
  const childrenOf = new Map();

  for (const n of allNodes) {
    if (!idSet.has(n.Id) || n.Id === n.P) continue;
    if (!idSet.has(n.P)) continue;
    if (!childrenOf.has(n.P)) childrenOf.set(n.P, []);
    childrenOf.get(n.P).push(n);
  }

  const roots = [...idSet]
    .map(id => byId.get(id))
    .filter(n => n && (!idSet.has(n.P) || n.Id === n.P));

  function buildNode(n) {
    const kids = (childrenOf.get(n.Id) || []).map(buildNode);
    const node = { id: n.Id, name: n.N };
    if (kids.length) node.children = kids;
    return node;
  }

  return roots.map(buildNode);
}

// ─── Extract JSON safely from Claude response ─────────────────
function extractJson(text) {
  // Try direct parse first
  try { return JSON.parse(text.trim()); } catch {}
  // Find first { ... } block
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  throw new Error(`No valid JSON found in: ${text.substring(0, 300)}`);
}

// ─── POST /api/claude-match ───────────────────────────────────
router.post('/claude-match', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ success: false, error: 'prompt is required.' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY not set.' });

  try {
    const { all, top } = loadData();

    console.log(`[claude-match] Sending ${top.length} top-level nodes to Claude for: "${prompt}"`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-6',
        max_tokens: 4096,
        system: `You are a business ERP configurator for MAA ERP.

You are given a compact list of top-level business sectors and modules from a
pre-built ERP library. Each entry has Id, P (parent), and N (name).

When the user describes their business, return ONLY the Ids of the sectors and
modules that are relevant. Do NOT return child nodes — we expand them locally.
Do NOT invent any IDs. Only use IDs from the provided list.

Return ONLY raw JSON — no markdown fences, no explanation:
{"matchedIds":["id1","id2"],"summary":"one sentence"}`,
        messages: [{
          role: 'user',
          content: `Top-level nodes:\n${JSON.stringify(top)}\n\nBusiness: "${prompt.trim()}"\n\nReturn matching IDs as raw JSON.`,
        }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API error (${response.status}): ${await response.text()}`);

    const data    = await response.json();
    const rawText = data.content?.[0]?.text || '';
    console.log(`[claude-match] Claude raw response (first 200): ${rawText.substring(0, 200)}`);

    const parsed     = extractJson(rawText);
    const topIds     = parsed.matchedIds || [];
    console.log(`[claude-match] Claude matched ${topIds.length} top-level IDs`);

    // Expand to include all descendants locally
    const expandedIds = expandWithDescendants(topIds, all);
    console.log(`[claude-match] Expanded to ${expandedIds.length} total nodes`);

    const tree = buildTree(expandedIds, all);

    return res.status(200).json({
      success:    true,
      prompt:     prompt.trim(),
      matchCount: expandedIds.length,
      summary:    parsed.summary || '',
      matchedIds: expandedIds,
      tree,
    });

  } catch (err) {
    console.error('[claude-match] Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
