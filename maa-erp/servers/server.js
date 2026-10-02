/**
 * server.js — MAA ERP Express Backend
 * =====================================
 * Endpoints:
 *   POST /api/query           — NLP query from third-party apps
 *   POST /api/query/explain   — NLP query + Claude explanation
 *   GET  /api/query/health    — Pinecone connectivity check
 *   POST /api/records/save    — Save table record
 *   GET  /api/records/:tableId — List records
 *   GET  /api/lookup/:id      — Resolve lookup Id → Name
 *   POST /api/types/reload    — Hot reload VanakkamPayanarssTypes.json
 *   GET  /api/health          — Server health
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import registry from './TypeRegistry.js';
import recordsRouter from './api/records.js';
import queryRouter from './api/queryRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Allow cross-origin requests from any third-party app
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT     = process.env.PORT || 3001;
const JSON_PATH = path.join(__dirname, 'public', 'data', 'VanakkamPayanarssTypes.json');

// ═══════════════════════════════════════════════════════════════
// 1. LOAD TypeRegistry AT STARTUP
// ═══════════════════════════════════════════════════════════════

try {
  registry.load(JSON_PATH);
} catch (err) {
  console.error(`❌ Failed to load VanakkamPayanarssTypes.json: ${err.message}`);
  process.exit(1);
}

// Attach registry to every request
app.use((req, _res, next) => { req.registry = registry; next(); });

// ═══════════════════════════════════════════════════════════════
// 2. MOUNT ROUTERS
// ═══════════════════════════════════════════════════════════════

app.use('/api/records', recordsRouter);
app.use('/api/query',   queryRouter);

// ═══════════════════════════════════════════════════════════════
// 3. LOOKUP API
// ═══════════════════════════════════════════════════════════════

app.get('/api/lookup/:id', (req, res) => {
  const name = registry.resolveLookup(req.params.id);
  res.json({ id: req.params.id, name });
});

app.post('/api/lookup/resolve', (req, res) => {
  const { ids = [] } = req.body;
  const result = {};
  for (const id of ids) result[id] = registry.resolveLookup(id);
  res.json(result);
});

app.get('/api/lookup/options/:lookupTypeId', (req, res) => {
  const options = registry.getLookupOptions(req.params.lookupTypeId);
  res.json(options.map(n => ({ id: n.Id, name: n.Name, description: n.Description })));
});

app.get('/api/types/:id/children', (req, res) => {
  res.json(registry.getChildren(req.params.id));
});

app.post('/api/types/reload', (_req, res) => {
  try {
    registry.reload();
    res.json({ success: true, status: registry.status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', registry: registry.status });
});

// ═══════════════════════════════════════════════════════════════
// 5. START
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀 MAA ERP server on http://localhost:${PORT}`);
  console.log(`\n── Query API (Third-party) ──`);
  console.log(`   POST /api/query            — NLP query → transaction results`);
  console.log(`   POST /api/query/explain    — NLP query + Claude explanation`);
  console.log(`   GET  /api/query/health     — Pinecone connectivity`);
  console.log(`\n── Records API ──`);
  console.log(`   POST /api/records/save     — Save record`);
  console.log(`   GET  /api/records/:tableId — List records`);
  console.log(`\n── Lookup API ──`);
  console.log(`   GET  /api/lookup/:id       — Resolve Id → Name`);
  console.log(`   GET  /api/types/reload     — Hot reload JSON\n`);
});
