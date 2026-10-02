/**
 * records.js — ESM Express Router
 * ================================
 * CRUD for PayanarssType table records.
 *
 * Storage: one JSON file per table at:
 *   servers/api/records/{tableId}.json
 *
 * File format:
 * {
 *   "tableId": "GYMTC000...",
 *   "tableName": "TargetCustomer",
 *   "records": [
 *     { "id": "uuid", "createdAt": "ISO", "updatedAt": "ISO", "data": { colId: value } }
 *   ]
 * }
 *
 * Endpoints (mounted at /api/records):
 *   POST   /api/records/save           — create or update
 *   GET    /api/records/:tableId       — list all records
 *   GET    /api/records/:tableId/:id   — single record
 *   DELETE /api/records/:tableId/:id   — delete record
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── Storage directory ────────────────────────────────────────

const RECORDS_DIR = path.join(__dirname, 'records');

if (!fs.existsSync(RECORDS_DIR)) {
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
}

// ─── Helpers ──────────────────────────────────────────────────

function sanitise(tableId) {
  return tableId.replace(/[^a-zA-Z0-9\-_]/g, '_');
}

function filePath(tableId) {
  return path.join(RECORDS_DIR, `${sanitise(tableId)}.json`);
}

function loadTable(tableId, tableName = '') {
  const fp = filePath(tableId);
  if (!fs.existsSync(fp)) return { tableId, tableName, records: [] };
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return { tableId, tableName, records: [] };
  }
}

function writeTable(tableId, data) {
  const fp = filePath(tableId);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, fp);
}

// ─── POST /api/records/save ───────────────────────────────────

router.post('/save', (req, res) => {
  try {
    const { tableId, tableName, recordId, data } = req.body;
    if (!tableId || !recordId || !data) {
      return res.status(400).json({ success: false, error: 'tableId, recordId and data are required' });
    }

    const now = new Date().toISOString();
    const table = loadTable(tableId, tableName);
    table.tableName = tableName || table.tableName;

    const idx = table.records.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      table.records[idx] = { ...table.records[idx], updatedAt: now, data: { ...data } };
    } else {
      table.records.push({ id: recordId, createdAt: now, updatedAt: now, data: { ...data } });
    }

    writeTable(tableId, table);
    console.log(`[records] Saved ${recordId} to ${sanitise(tableId)}.json (${table.records.length} total)`);

    return res.json({ success: true, recordId, tableId, total: table.records.length });
  } catch (err) {
    console.error('[records] Save error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/records/:tableId ────────────────────────────────

router.get('/:tableId', (req, res) => {
  try {
    const table = loadTable(req.params.tableId);
    return res.json({ success: true, ...table, count: table.records.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/records/:tableId/:id ───────────────────────────

router.get('/:tableId/:id', (req, res) => {
  try {
    const table = loadTable(req.params.tableId);
    const record = table.records.find(r => r.id === req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    return res.json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/records/:tableId/:id ────────────────────────

router.delete('/:tableId/:id', (req, res) => {
  try {
    const { tableId, id } = req.params;
    const table = loadTable(tableId);
    const before = table.records.length;
    table.records = table.records.filter(r => r.id !== id);
    if (table.records.length === before) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    writeTable(tableId, table);
    console.log(`[records] Deleted ${id} from ${sanitise(tableId)}.json`);
    return res.json({ success: true, recordId: id, total: table.records.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
