import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'

// ═══════════════════════════════════════════════════════════════
// Shared helpers for Vite server plugins
// ═══════════════════════════════════════════════════════════════

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '')
}

// ═══════════════════════════════════════════════════════════════
// Vite Plugin: Save Records API (local file system)
// ═══════════════════════════════════════════════════════════════

function saveRecordsPlugin(): Plugin {
  const DATA_DIR = path.resolve(__dirname, 'data/records')

  function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`Created directory: ${dir}`)
    }
  }

  return {
    name: 'save-maa-erp-records',
    configureServer(server) {

      server.middlewares.use('/api/records/save', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          const body = await readBody(req)
          const { recordType, tableId, data, parentRecordId } = JSON.parse(body)
          if (!recordType || !data) { json(res, 400, { error: 'Missing recordType or data' }); return }
          if (!tableId) { json(res, 400, { error: 'Missing tableId' }); return }

          const tableDir = path.join(DATA_DIR, sanitize(tableId))
          ensureDir(tableDir)

          const id = crypto.randomUUID()
          const now = new Date().toISOString()
          const record = {
            id, recordType, tableId,
            createdAt: now, updatedAt: now,
            ...(parentRecordId ? { parentRecordId } : {}),
            data,
          }

          fs.writeFileSync(path.join(tableDir, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8')
          console.log(`Saved ${recordType} -> ${tableId}/${id}.json`)
          json(res, 200, { success: true, id })
        } catch (err) {
          console.error('Save failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })

      server.middlewares.use('/api/records/list', (req, res) => {
        if (req.method !== 'GET') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          const url = new URL(req.url || '', 'http://localhost')
          const filterTableId = url.searchParams.get('tableId')
          const filterParent = url.searchParams.get('parentId')
          ensureDir(DATA_DIR)

          const records: Record<string, unknown>[] = []
          const tableDirs = filterTableId
            ? [sanitize(filterTableId)]
            : fs.readdirSync(DATA_DIR).filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory())

          for (const dir of tableDirs) {
            const dirPath = path.join(DATA_DIR, dir)
            if (!fs.existsSync(dirPath)) continue
            for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.json'))) {
              try {
                const record = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'))
                if (filterParent && record.parentRecordId !== filterParent) continue
                records.push(record)
              } catch { console.warn(`Skipped unreadable: ${dir}/${file}`) }
            }
          }

          records.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
            new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
          )
          json(res, 200, { success: true, records, count: records.length })
        } catch (err) {
          console.error('List failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })

      server.middlewares.use('/api/records/get', (req, res) => {
        if (req.method !== 'GET') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          const url = new URL(req.url || '', 'http://localhost')
          const id = url.searchParams.get('id')
          const tableId = url.searchParams.get('tableId')
          if (!id) { json(res, 400, { error: 'Missing id parameter' }); return }
          const safeId = sanitize(id)

          if (tableId) {
            const fp = path.join(DATA_DIR, sanitize(tableId), `${safeId}.json`)
            if (!fs.existsSync(fp)) { json(res, 404, { error: 'Record not found' }); return }
            json(res, 200, JSON.parse(fs.readFileSync(fp, 'utf-8'))); return
          }

          ensureDir(DATA_DIR)
          for (const dir of fs.readdirSync(DATA_DIR).filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory())) {
            const fp = path.join(DATA_DIR, dir, `${safeId}.json`)
            if (fs.existsSync(fp)) { json(res, 200, JSON.parse(fs.readFileSync(fp, 'utf-8'))); return }
          }
          json(res, 404, { error: 'Record not found' })
        } catch (err) {
          console.error('Get failed:', err)
          json(res, 500, { error: String(err) })
        }
      })

      server.middlewares.use('/api/records/delete', (req, res) => {
        if (req.method !== 'DELETE') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          const url = new URL(req.url || '', 'http://localhost')
          const id = url.searchParams.get('id')
          const tableId = url.searchParams.get('tableId')
          if (!id) { json(res, 400, { error: 'Missing id parameter' }); return }
          const safeId = sanitize(id)

          if (tableId) {
            const fp = path.join(DATA_DIR, sanitize(tableId), `${safeId}.json`)
            if (!fs.existsSync(fp)) { json(res, 404, { error: 'Record not found' }); return }
            fs.unlinkSync(fp)
            json(res, 200, { success: true, id: safeId }); return
          }

          ensureDir(DATA_DIR)
          for (const dir of fs.readdirSync(DATA_DIR).filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory())) {
            const fp = path.join(DATA_DIR, dir, `${safeId}.json`)
            if (fs.existsSync(fp)) { fs.unlinkSync(fp); json(res, 200, { success: true, id: safeId }); return }
          }
          json(res, 404, { error: 'Record not found' })
        } catch (err) {
          console.error('Delete failed:', err)
          json(res, 500, { error: String(err) })
        }
      })
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Vite Plugin: Business Config (save/load from data/business-config.json)
// ═══════════════════════════════════════════════════════════════

function businessConfigPlugin(): Plugin {
  const CONFIG_PATH = path.resolve(__dirname, 'data/business-config.json')

  function ensureDataDir(): void {
    const dir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  return {
    name: 'business-config',
    configureServer(server) {

      // ─── POST /api/config/save ────────────────────────────
      server.middlewares.use('/api/config/save', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          ensureDataDir()
          const body = await readBody(req)
          const config = JSON.parse(body)
          config.updatedAt = new Date().toISOString()
          if (!config.createdAt) {
            // Preserve original createdAt if updating
            try {
              const existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
              config.createdAt = existing.createdAt || config.updatedAt
            } catch { config.createdAt = config.updatedAt }
          }
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
          console.log('Business config saved ->', CONFIG_PATH)
          json(res, 200, { success: true })
        } catch (err) {
          console.error('Config save failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })

      // ─── GET /api/config/load ─────────────────────────────
      server.middlewares.use('/api/config/load', (req, res) => {
        if (req.method !== 'GET') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          if (!fs.existsSync(CONFIG_PATH)) {
            json(res, 200, { success: true, exists: false, config: null })
            return
          }
          const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
          json(res, 200, { success: true, exists: true, config })
        } catch (err) {
          console.error('Config load failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// Vite Plugin: Pinecone Vector DB (integrated inference)
//
// Option C: Hybrid approach
//   EMBED  → keyword-rich natural text (what a human would search for)
//   METADATA → structured fields (what a computer filters/sorts by)
//
// Endpoints:
//   POST /api/pinecone/init    — lazy-init client, verify index
//   POST /api/pinecone/upsert  — embed + metadata upsert
//   POST /api/pinecone/query   — semantic search with optional filter
//   POST /api/pinecone/delete  — remove record from index
// ═══════════════════════════════════════════════════════════════

function pineconePlugin(): Plugin {

  // ─── Server-side column label mapping ──────────────────────
  // Duplicated here because tsconfig.node.json only compiles vite.config.ts
  const COL_LABELS: Record<string, string> = {
    'COL00000000000000000000004670000': 'EmployeeCode',
    'COL00000000000000000000004680000': 'Name',
    'COL00000000000000000000004690000': 'LastName',
    'COL00000000000000000000004700000': 'Email',
    'COL00000000000000000000004710000': 'Phone',
    'COL00000000000000000000004720000': 'DOB',
    'COL00000000000000000000004750000': 'Department',
    'COL00000000000000000000004760000': 'Designation',
    'COL00000000000000000000004770000': 'JoiningDate',
    'COL00000000000000000000004780000': 'Status',
    'COL00000000000000000000008780000': 'EmployeeId',
    'COL00000000000000000000008790000': 'Basic',
    'COL00000000000000000000008800000': 'Housing',
    'COL00000000000000000000008810000': 'Transport',
    'COL00000000000000000000008820000': 'OtherAllowance',
    'COL00000000000000000000008830000': 'TotalGross',
    'COL00000000000000000000008840000': 'Currency',
    'COL00000000000000000000008850000': 'EffectiveDate',
    'COL00000000000000000000004900000': 'EmployeeId',
    'COL00000000000000000000004910000': 'AddressType',
    'COL00000000000000000000004920000': 'Address',
    'COL00000000000000000000004930000': 'City',
    'COL00000000000000000000004940000': 'State',
    'COL00000000000000000000004950000': 'Country',
    'COL00000000000000000000004960000': 'PostalCode',
    'COL00000000000000000000005050000': 'EmployeeId',
    'COL00000000000000000000005060000': 'DocumentType',
    'COL00000000000000000000005070000': 'DocumentNumber',
    'COL00000000000000000000005080000': 'IssueDate',
    'COL00000000000000000000005090000': 'ExpiryDate',
    'COL00000000000000000000005100000': 'Attachment',
    'COL00000000000000000000000630000': 'BankName',
    'COL00000000000000000000000640000': 'IBAN',
    'COL00000000000000000000000650000': 'Category',
    'COL00000000000000000000000660000': 'Description',
  }

  const RECORD_TYPE_LABELS: Record<string, string> = {
    employee:  'Employee',
    salary:    'SalaryStructure',
    address:   'EmployeeAddress',
    documents: 'EmployeeDocument',
    bank:      'BankAccount',
  }

  const RECORD_TYPE_MODULE: Record<string, string> = {
    employee: 'HR', salary: 'HR', address: 'HR',
    documents: 'HR', bank: 'Finance',
  }

  // Fields that contain numeric values (for metadata number filtering)
  const NUMERIC_FIELDS = new Set([
    'COL00000000000000000000008790000', // Basic
    'COL00000000000000000000008800000', // Housing
    'COL00000000000000000000008810000', // Transport
    'COL00000000000000000000008820000', // OtherAllowance
    'COL00000000000000000000008830000', // TotalGross
  ])

  /**
   * Option C: Hybrid — build keyword-rich embedding text.
   * No filler words, just table name + module + key values.
   *
   * Example output:
   *   "Employee HR Ahmed Al Mansoori EMP-003 Personal Trainer Technical 1990-01-15"
   */
  function buildEmbedText(recordType: string, data: Record<string, unknown>): string {
    const table = RECORD_TYPE_LABELS[recordType] || recordType
    const module = RECORD_TYPE_MODULE[recordType] || ''
    const values = Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([, v]) => String(v))
      .join(' ')
    return `${table} ${module} ${values}`.trim()
  }

  /**
   * Build structured metadata for Pinecone filtering.
   * Numbers stay as numbers, everything else as strings.
   */
  function buildMetadata(
    recordType: string,
    tableId: string,
    data: Record<string, unknown>,
    parentRecordId?: string,
  ): Record<string, string | number | boolean> {
    const meta: Record<string, string | number | boolean> = {
      table: RECORD_TYPE_LABELS[recordType] || recordType,
      module: RECORD_TYPE_MODULE[recordType] || '',
      entity_type: recordType,
      table_id: tableId,
    }

    if (parentRecordId) meta.parent_record_id = parentRecordId

    // Map each COL ID → human-readable metadata key with proper types
    for (const [colId, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === '') continue
      const label = COL_LABELS[colId] || colId
      // Store numbers as numbers for range filtering
      if (NUMERIC_FIELDS.has(colId)) {
        const num = parseFloat(String(value))
        if (!isNaN(num)) { meta[label] = num; continue }
      }
      meta[label] = String(value)
    }

    // Add date metadata for time-based filtering
    const now = new Date()
    meta.date = now.toISOString().split('T')[0]
    meta.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    meta.year = now.getFullYear()

    return meta
  }

  // ─── Pinecone client state ─────────────────────────────────
  let pc: import('@pinecone-database/pinecone').Pinecone | null = null
  let indexName = ''
  let initPromise: Promise<void> | null = null
  let initError: string | null = null

  async function ensureInit(): Promise<void> {
    if (pc) return
    if (initError) throw new Error(initError)
    if (initPromise) return initPromise

    initPromise = (async () => {
      const dotenv = await import('dotenv')
      dotenv.config({ path: path.resolve(__dirname, '.env') })

      const apiKey = process.env.PINECONE_API_KEY
      indexName = process.env.PINECONE_INDEX_NAME || 'payanarss-records'

      if (!apiKey) {
        initError = 'PINECONE_API_KEY not set in .env'
        throw new Error(initError)
      }

      const { Pinecone } = await import('@pinecone-database/pinecone')
      pc = new Pinecone({ apiKey })

      // Verify index exists
      const existing = await pc.listIndexes()
      const found = existing.indexes?.some((idx: { name: string }) => idx.name === indexName)

      if (!found) {
        // Index doesn't exist — create with integrated inference
        console.log(`Creating Pinecone index: ${indexName}`)
        await pc.createIndexForModel({
          name: indexName,
          cloud: (process.env.PINECONE_CLOUD || 'aws') as 'aws' | 'gcp' | 'azure',
          region: process.env.PINECONE_REGION || 'us-east-1',
          embed: {
            model: 'multilingual-e5-large',
            fieldMap: { text: 'content' },
          },
          waitUntilReady: true,
        })
      }

      console.log(`Pinecone connected -> index: ${indexName}`)
    })()

    return initPromise
  }

  return {
    name: 'pinecone-vector-db',
    configureServer(server) {

      // ─── POST /api/pinecone/init ────────────────────────
      server.middlewares.use('/api/pinecone/init', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          await ensureInit()
          json(res, 200, { success: true, index: indexName })
        } catch (err) {
          json(res, 500, { success: false, error: String(err) })
        }
      })

      // ─── POST /api/pinecone/upsert ──────────────────────
      server.middlewares.use('/api/pinecone/upsert', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          await ensureInit()
          const body = await readBody(req)
          const { recordId, recordType, tableId, data, parentRecordId } = JSON.parse(body)

          if (!recordId || !recordType || !data) {
            json(res, 400, { error: 'Missing recordId, recordType, or data' }); return
          }

          // Option C: Hybrid — embed text + structured metadata
          const content = buildEmbedText(recordType, data)
          const metadata = buildMetadata(recordType, tableId, data, parentRecordId)

          const index = pc!.index(indexName)
          await index.namespace('default').upsertRecords([
            {
              id: recordId,
              content,      // This field is auto-embedded by Pinecone (fieldMap.text = 'content')
              ...metadata,  // Stored as filterable metadata
            },
          ])

          console.log(`Pinecone upsert -> ${recordType}/${recordId} "${content.substring(0, 60)}..."`)
          json(res, 200, { success: true, recordId, contentLength: content.length })
        } catch (err) {
          console.error('Pinecone upsert failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })

      // ─── POST /api/pinecone/query ───────────────────────
      server.middlewares.use('/api/pinecone/query', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          await ensureInit()
          const body = await readBody(req)
          const { query, topK = 5, recordType, filter } = JSON.parse(body)

          if (!query) { json(res, 400, { error: 'Missing query text' }); return }

          const index = pc!.index(indexName)

          // Build filter from optional params
          const queryFilter: Record<string, unknown> = {}
          if (recordType) queryFilter.entity_type = { $eq: recordType }
          if (filter) Object.assign(queryFilter, filter)

          const searchParams: Record<string, unknown> = {
            query: {
              inputs: { text: query },
              topK,
              ...(Object.keys(queryFilter).length > 0 ? { filter: queryFilter } : {}),
            },
            fields: [
              'content', 'table', 'module', 'entity_type', 'table_id',
              'parent_record_id', 'date', 'month', 'year',
              // Employee fields
              'Name', 'EmployeeCode', 'Department', 'Designation', 'DOB', 'Status',
              // Salary fields
              'Basic', 'Housing', 'Transport', 'TotalGross', 'Currency',
              // Address fields
              'Address', 'City', 'Country',
              // Document fields
              'DocumentType', 'DocumentNumber', 'ExpiryDate',
              // Bank fields
              'BankName', 'IBAN',
            ],
          }

          const results = await index.namespace('default').searchRecords(searchParams)

          // Extract hits from Pinecone response shape: { result: { hits: [...] } }
          const hits = (results as Record<string, unknown>)?.result
            ? ((results as Record<string, { hits: unknown[] }>).result.hits || [])
            : (Array.isArray(results) ? results : [])

          console.log(`Pinecone query -> "${query}" -> ${(hits as unknown[]).length} hits`)
          json(res, 200, { success: true, results: hits })
        } catch (err) {
          console.error('Pinecone query failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })

      // ─── POST /api/pinecone/delete ──────────────────────
      server.middlewares.use('/api/pinecone/delete', async (req, res) => {
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return }
        try {
          await ensureInit()
          const body = await readBody(req)
          const { recordId } = JSON.parse(body)
          if (!recordId) { json(res, 400, { error: 'Missing recordId' }); return }

          const index = pc!.index(indexName)
          await index.namespace('default').deleteOne(recordId)

          console.log(`Pinecone delete -> ${recordId}`)
          json(res, 200, { success: true, recordId })
        } catch (err) {
          console.error('Pinecone delete failed:', err)
          json(res, 500, { success: false, error: String(err) })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveRecordsPlugin(), businessConfigPlugin(), pineconePlugin()],
})
