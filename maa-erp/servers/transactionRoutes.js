import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const RECORDS_DIR = path.resolve(__dirname, 'public/data/records');

if (!fs.existsSync(RECORDS_DIR)) {
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
  console.log('[transactions] Created records folder:', RECORDS_DIR);
}

function sanitiseTypeId(typeId) {
  return typeId.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

function readRecords(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[transactions] Corrupt JSON in', filePath);
    fs.copyFileSync(filePath, filePath + '.bak_' + Date.now());
    return [];
  }
}

function writeRecords(filePath, records) {
  const tmp = filePath + '.tmp_' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// POST /api/transactions/save
router.post('/transactions/save', (req, res) => {
  const { payanarssTypeId, data } = req.body;

  if (!payanarssTypeId || typeof payanarssTypeId !== 'string' || !payanarssTypeId.trim()) {
    return res.status(400).json({ success: false, error: 'payanarssTypeId is required.' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ success: false, error: 'data must be a JSON object.' });
  }

  const transactionId = uuidv4();
  const timestamp     = new Date().toISOString();
  const safeTypeId    = sanitiseTypeId(payanarssTypeId.trim());
  const filePath      = path.join(RECORDS_DIR, safeTypeId + '.json');

  const record = { transactionId, payanarssTypeId: payanarssTypeId.trim(), timestamp, data };

  try {
    const existing = readRecords(filePath);
    existing.push(record);
    writeRecords(filePath, existing);
  } catch (err) {
    console.error('[transactions] Write error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to save transaction.' });
  }

  console.log('[transactions] Saved', transactionId, '->', safeTypeId + '.json');
  return res.status(201).json({
    success: true, transactionId,
    payanarssTypeId: payanarssTypeId.trim(), timestamp,
    filePath: 'public/data/records/' + safeTypeId + '.json',
  });
});

// GET /api/transactions/:payanarssTypeId
router.get('/transactions/:payanarssTypeId', (req, res) => {
  const safeTypeId = sanitiseTypeId(req.params.payanarssTypeId);
  const filePath   = path.join(RECORDS_DIR, safeTypeId + '.json');

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'No records found for: ' + req.params.payanarssTypeId });
  }
  try {
    const records = readRecords(filePath);
    return res.status(200).json({ success: true, count: records.length, records });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to read records.' });
  }
});

export default router;
