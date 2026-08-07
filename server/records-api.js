// Local "sent records" store — the bridge between the Nurse Notes clinician
// web app and the Nurse Notes patient phone app.
//
// There is no cloud (see CLAUDE.md §1: runs fully offline / on-device). This
// plugin adds a tiny JSON-backed inbox to the SAME Vite dev/preview server the
// web app already runs on. When the clinician submits an approved summary, the
// web app POSTs it here; the phone app GETs the list. Both apps run on the one
// machine during the demo, so localhost is the whole network.
//
// Persistence is a flat JSON file (.data/records.json, gitignored) so submitted
// records survive a page reload / server restart during the demo.

import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = '.data'
const DATA_FILE = path.join(DATA_DIR, 'records.json')

function ensureStore(root) {
  const dir = path.join(root, DATA_DIR)
  const file = path.join(root, DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf8')
  return file
}

function readRecords(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecords(file, records) {
  fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf8')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 5_000_000) reject(new Error('Payload too large')) // ~5MB guard
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  // The phone app is served from a different origin (Expo web / Metro), so the
  // store has to be reachable cross-origin. This is a local-only dev endpoint.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

// Connect-style middleware shared by both `server` and `preview`.
function makeMiddleware(root) {
  const file = ensureStore(root)

  return async (req, res, next) => {
    const url = (req.url || '').split('?')[0]
    if (!url.startsWith('/api/records')) return next()

    // CORS preflight.
    if (req.method === 'OPTIONS') return sendJson(res, 204, {})

    try {
      // GET /api/records — newest first.
      if (req.method === 'GET' && url === '/api/records') {
        const records = readRecords(file).sort(
          (a, b) => (b.submittedAt || 0) - (a.submittedAt || 0),
        )
        return sendJson(res, 200, records)
      }

      // POST /api/records — append a submitted record.
      if (req.method === 'POST' && url === '/api/records') {
        const raw = await readBody(req)
        let incoming
        try {
          incoming = JSON.parse(raw || '{}')
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON body' })
        }
        if (!incoming || !String(incoming.plainText || '').trim()) {
          return sendJson(res, 400, { error: 'plainText is required' })
        }
        const record = {
          id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          submittedAt: Date.now(),
          patientName: incoming.patientName || 'Patient',
          nhi: incoming.nhi || '',
          ward: incoming.ward || '',
          hospital: incoming.hospital || '',
          approvedBy: incoming.approvedBy || '',
          approvedAt: incoming.approvedAt || '',
          plainText: String(incoming.plainText),
          originalText: String(incoming.originalText || ''),
          readingGrade: incoming.readingGrade ?? null,
          jargonCount: incoming.jargonCount ?? null,
        }
        const records = readRecords(file)
        records.push(record)
        writeRecords(file, records)
        return sendJson(res, 201, record)
      }

      // DELETE /api/records — clear all (demo reset).
      if (req.method === 'DELETE' && url === '/api/records') {
        writeRecords(file, [])
        return sendJson(res, 200, { ok: true })
      }

      // DELETE /api/records/:id — remove one.
      if (req.method === 'DELETE' && url.startsWith('/api/records/')) {
        const id = decodeURIComponent(url.slice('/api/records/'.length))
        const records = readRecords(file).filter((r) => r.id !== id)
        writeRecords(file, records)
        return sendJson(res, 200, { ok: true })
      }

      return sendJson(res, 405, { error: 'Method not allowed' })
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Store error' })
    }
  }
}

// Vite plugin: mount the middleware on both the dev server and `vite preview`.
export function recordsApi() {
  return {
    name: 'nurse-notes-records-api',
    configureServer(server) {
      server.middlewares.use(makeMiddleware(server.config.root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(makeMiddleware(server.config.root))
    },
  }
}
